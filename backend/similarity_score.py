import os, io
import requests
import librosa
import torch
from transformers import Wav2Vec2Processor, Data2VecAudioModel
from sklearn.metrics.pairwise import cosine_similarity

from dotenv import load_dotenv
load_dotenv()

import time

def _get_embedding(file_id):
    processor = Wav2Vec2Processor.from_pretrained("facebook/data2vec-audio-base-960h")
    model = Data2VecAudioModel.from_pretrained("m-a-p/music2vec-v1")

    sampling_rate=16000

    url = os.getenv('AWS_FILE_FORM').replace('placeholder', file_id)
    response = requests.get(url)

    if response.status_code == 200:
        audio_array, _ = librosa.load(io.BytesIO(response.content), sr=sampling_rate)
    else:
        print(f"Failed to access file. Status code: {response.status_code}")
        return []

    inputs = processor(audio_array, sampling_rate=sampling_rate, return_tensors="pt")

    with torch.inference_mode():
        outputs = model(**inputs)

    embedding = outputs.last_hidden_state.mean(dim=1).flatten().cpu().numpy()
    return embedding

def similarity_score(orig_file, guess_file, start_time):
    start = time.time()
    embedding1 = _get_embedding(orig_file).reshape(1, -1)
    embedding2 = _get_embedding(guess_file).reshape(1, -1)
    cosine_sim = cosine_similarity(embedding1, embedding2)[0][0]
    print(cosine_sim)
    print(time.time() - start)

embedding = similarity_score('blinding-lights', 'see-you-again')