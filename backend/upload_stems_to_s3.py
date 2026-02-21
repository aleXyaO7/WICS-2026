"""
Upload all stem files from a downloads subfolder to S3.
Each file is matched to an instrument (drums, piano, vocals, etc.) from its filename
and uploaded as {object_name}-{instrument}.wav.
"""

import os

# Instrument names to look for in filenames (case-insensitive).
# Order matters: "vocals" before "vocal" so we match the full word first.
INSTRUMENTS = ["drums", "piano", "vocals", "bass", "guitar", "other"]


def _instrument_from_filename(filename):
    """Return the instrument key if the filename suggests one, else None."""
    name_lower = os.path.splitext(filename)[0].lower()
    for inst in INSTRUMENTS:
        if inst in name_lower:
            return inst
    return None


def upload_stems_to_s3(folder_name, object_name, bucket, downloads_root="downloads"):
    """
    Upload all stem files in a downloads subfolder to S3, with the instrument
    appended to the object name (e.g. object_name="song" -> song-drums.wav, song-piano.wav).

    Parameters
    ----------
    folder_name : str
        Subfolder under downloads (e.g. "Blinding Lights" -> downloads/Blinding Lights).
    object_name : str
        Base S3 key without extension (e.g. "blinding-lights"). Each file is uploaded
        as {object_name}-{instrument}.wav.
    bucket : str
        S3 bucket name.
    downloads_root : str
        Root folder for downloads; default "downloads".

    Returns
    -------
    dict
        {"uploaded": [(local_path, s3_key), ...], "skipped": [path, ...]}
    """
    import aws

    folder_path = os.path.join(downloads_root, folder_name)
    if not os.path.isdir(folder_path):
        raise FileNotFoundError(f"Folder not found: {folder_path}")

    object_name = object_name.rstrip("/").rstrip(".wav")
    uploaded = []
    skipped = []

    for filename in os.listdir(folder_path):
        if not filename.lower().endswith((".wav", ".mp3", ".m4a")):
            continue
        local_path = os.path.join(folder_path, filename)
        if not os.path.isfile(local_path):
            continue

        instrument = _instrument_from_filename(filename)
        if instrument is None:
            skipped.append(local_path)
            continue

        s3_key = f"{object_name}-{instrument}.wav"
        if aws.upload_file(local_path, bucket, s3_key):
            uploaded.append((local_path, s3_key))
            print(f"Uploaded {filename} -> s3://{bucket}/{s3_key}")
        else:
            skipped.append(local_path)

    if skipped:
        print(f"Skipped (no instrument match or upload failed): {[os.path.basename(p) for p in skipped]}")
    return {"uploaded": uploaded, "skipped": skipped}


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4:
        print("Usage: python upload_stems_to_s3.py <folder_name> <object_name> <bucket>")
        print("  folder_name: subfolder under downloads (e.g. 'Blinding Lights')")
        print("  object_name: base S3 key (e.g. 'blinding-lights') -> uploads blinding-lights-drums.wav, etc.")
        print("  bucket: S3 bucket name")
        sys.exit(1)
    folder_name = sys.argv[1]
    object_name = sys.argv[2]
    bucket = sys.argv[3]
    result = upload_stems_to_s3(folder_name, object_name, bucket)
    print(f"Done: {len(result['uploaded'])} uploaded, {len(result['skipped'])} skipped")
    sys.exit(0 if result["uploaded"] else 1)
