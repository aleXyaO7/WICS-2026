import os, io, time, requests
import librosa
import torch
import numpy as np
from transformers import Wav2Vec2Processor, Data2VecAudioModel
from sklearn.metrics.pairwise import cosine_similarity

from dotenv import load_dotenv
load_dotenv()

from supabase_helpers import get_metadata_by_spotify_id

sampling_rate=16000
song_lookup = {}
with open('songmap.txt') as f:
    for line in f.read().split('\n'):
        song_lookup[line.split(',')[0]] = line.split(',')[1]

# Retrieves audio file from s3 bucket and converts to list
def _get_audio_array(file_id):
    url = os.getenv('AWS_FILE_FORM').replace('placeholder', file_id)
    response = requests.get(url)
    if response.status_code == 200:
        audio_array, _ = librosa.load(io.BytesIO(response.content), sr=sampling_rate)
    else:
        print(f"Failed to access id. Status code: {response.status_code}")
        return []
    return audio_array

# Feedforwards an audio window through pretrained model
def _get_embedding(processor, model, audio_array):
    inputs = processor(audio_array, sampling_rate=sampling_rate, return_tensors="pt")
    with torch.inference_mode():
        outputs = model(**inputs)

    embedding = outputs.last_hidden_state.mean(dim=1).cpu().numpy()
    return embedding

# Calculates the maximum similarity between first audio clip and various windows in the second song
def _embedding_score(orig_id, guess_id, start_second, duration):
    processor = Wav2Vec2Processor.from_pretrained("facebook/data2vec-audio-base-960h")
    model = Data2VecAudioModel.from_pretrained("m-a-p/music2vec-v1")

    max_sim = 0

    orig_audio_array = _get_audio_array(orig_id)[start_second * sampling_rate : (start_second + duration) * sampling_rate]
    orig_embedding = _get_embedding(processor, model, orig_audio_array)

    guess_audio_array_all = _get_audio_array(guess_id)
    guess_audio_array = []
    guess_padding = 5
    pointer = 0
    while True:
        if pointer + duration * sampling_rate > len(guess_audio_array_all):
            guess_audio_array.append(guess_audio_array_all[len(guess_audio_array_all) - duration * sampling_rate : len(guess_audio_array_all)])
            break
        guess_audio_array.append(guess_audio_array_all[pointer : pointer + duration * sampling_rate])
        pointer += guess_padding * sampling_rate
    
    guess_embedding = _get_embedding(processor, model, guess_audio_array)
    max_sim = max(cosine_similarity(orig_embedding, guess_embedding)[0])
    return max_sim

# Cool way to determine difference between two major/minor scales
def _circle_of_fifths(key1, mode1, key2, mode2):
    pos1 = ((key1 + 3 * (mode1 == 0)) * 7) % 12
    pos2 = ((key2 + 3 * (mode2 == 0)) * 7) % 12
    diff = abs(pos1 - pos2)
    return 1 - (min(diff, 12 - diff) / 6)

# Calculates the difference between various metadata labels
def _filter_metadata_diff(orig_id, guess_id):
    orig_metadata = get_metadata_by_spotify_id(song_lookup[orig_id])
    guess_metadata = get_metadata_by_spotify_id(song_lookup[guess_id])
    
    results = {
        'key' : _circle_of_fifths(orig_metadata['key'], orig_metadata['mode'], guess_metadata['key'], guess_metadata['mode']),
        'tempo' : 1 - abs(orig_metadata['tempo'] - guess_metadata['tempo']) / 150,
        'energy' : 1 - abs(orig_metadata['energy'] - guess_metadata['energy']),
        'mood' : 1 - abs(orig_metadata['valence'] + orig_metadata['danceability'] - guess_metadata['valence'] - guess_metadata['danceability']),
        'loud' : 1 - abs(orig_metadata['loudness'] - guess_metadata['loudness']),
    }
    return results

# Returns a float between 0 and 1 denoting similarity
def similarity_score(orig_id, guess_id, start_second, duration=15):
    max_sim = _embedding_score(orig_id, guess_id, start_second, duration)
    metadata_diff = _filter_metadata_diff(orig_id, guess_id)

    characteristics = np.array([
        max_sim, 
        metadata_diff['key'], 
        metadata_diff['tempo'], 
        metadata_diff['energy'],
        metadata_diff['mood'],
        metadata_diff['loud'],
    ])
    weights = np.array([0.4, 0.2, 0.15, 0.1, 0.1, 0.05])
    return np.sum(characteristics * weights)

# Example usage: similarity_score('blinding-lights', 'see-you-again', 10, 15)