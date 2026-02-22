import os, io, time, requests
import librosa
import torch
from transformers import Wav2Vec2Processor, Data2VecAudioModel
from sklearn.metrics.pairwise import cosine_similarity

from dotenv import load_dotenv
load_dotenv()

sampling_rate=16000

def _get_audio_array(file_id):
    url = os.getenv('AWS_FILE_FORM').replace('placeholder', file_id)
    response = requests.get(url)
    if response.status_code == 200:
        audio_array, _ = librosa.load(io.BytesIO(response.content), sr=sampling_rate)
    else:
        print(f"Failed to access file. Status code: {response.status_code}")
        return []
    return audio_array

def _get_embedding(processor, model, audio_array):
    inputs = processor(audio_array, sampling_rate=sampling_rate, return_tensors="pt")
    with torch.inference_mode():
        outputs = model(**inputs)

    embedding = outputs.last_hidden_state.mean(dim=1).cpu().numpy()
    return embedding

def _embedding_score(orig_file, guess_file, start_second, duration):
    processor = Wav2Vec2Processor.from_pretrained("facebook/data2vec-audio-base-960h")
    model = Data2VecAudioModel.from_pretrained("m-a-p/music2vec-v1")

    max_sim = 0

    orig_audio_array = _get_audio_array(orig_file)[start_second * sampling_rate : (start_second + duration) * sampling_rate]
    orig_embedding = _get_embedding(processor, model, orig_audio_array)

    guess_audio_array_all = _get_audio_array(guess_file)
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

def similarity_score(orig_file, guess_file, start_second, duration):
    max_sim = _embedding_score(orig_file, guess_file, start_second, duration)

    return max_sim

sim = similarity_score('blinding-lights', 'see-you-again', 10, 15)