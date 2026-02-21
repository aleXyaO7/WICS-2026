import os, boto3
from dotenv import load_dotenv
from botocore.client import Config

if not os.environ.get("GITHUB_ACTIONS") and not os.environ.get("DYNO"):
    load_dotenv()   # .env in cwd
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))  # project root
    load_dotenv("env")

def upload_file(filename, bucket, object_name=None):
    '''
    Upload a file to an s3 bucket
    Parameters
    ----------
    filename : string
        filename for file to be uploaded
    bucket : string
        name of bucket to be uploaded to
    object_name : string
        name of file once uploaded, defaulted to filename

    Returns
    -------
    boolean
        True if successful, False otherwise
    '''
    if object_name is None:
        object_name = os.path.basename(filename)
    access = os.getenv('AWS_ID') or os.getenv('AWS_ACCESS_KEY_ID')
    secret = os.getenv('AWS_KEY') or os.getenv('AWS_SECRET_ACCESS_KEY')
    client = boto3.client('s3', aws_access_key_id=access, aws_secret_access_key=secret)
    try:
        client.upload_file(filename, bucket, object_name)
    except Exception as e:
        print(f"file at {filename} was not successfully uploaded {e}")
        return False
    return True

def download_file(filename, bucketname, dir):
    '''
    Download a file from s3 bucket
    Parameters
    ----------
    filename : string
        filename for file to be downloaded
    bucket : string
        name of bucket to be downloaded from
    dir : string
        desired directory for download

    Returns
    -------
    boolean
        True if successful, False otherwise
    '''
    access = os.getenv('AWS_ID') or os.getenv('AWS_ACCESS_KEY_ID')
    secret = os.getenv('AWS_KEY') or os.getenv('AWS_SECRET_ACCESS_KEY')
    client = boto3.client('s3', aws_access_key_id=access, aws_secret_access_key=secret)
    try:
        client.download_file(bucketname, filename, dir)
        print(f"File '{filename}' downloaded from bucket '{bucketname}' to '{dir}'")
    except:
        print(f"failed to download {filename} from {bucketname} to {dir}")
        return False
    return True

def delete_file(filename, bucketname):
    access = os.getenv('AWS_ID') or os.getenv('AWS_ACCESS_KEY_ID')
    secret = os.getenv('AWS_KEY') or os.getenv('AWS_SECRET_ACCESS_KEY')
    client = boto3.client('s3', aws_access_key_id=access, aws_secret_access_key=secret)
    try:
        client.delete_object(Bucket=bucketname, Key=filename)
        print(f"File '{filename}' deleted from bucket '{bucketname}'")
    except Exception:
        print(f"failed to delete {filename} from {bucketname}")
        return False
    return True

def generate_url(filename, bucketname):
    access = os.getenv('AWS_ID') or os.getenv('AWS_ACCESS_KEY_ID')
    secret = os.getenv('AWS_KEY') or os.getenv('AWS_SECRET_ACCESS_KEY')
    client = boto3.client('s3', aws_access_key_id=access, aws_secret_access_key=secret, config=Config(
            signature_version="s3v4",
            region_name="us-east-2",
        ))
    url = client.generate_presigned_url(ClientMethod='get_object', Params={'Bucket' : bucketname, 'Key' : filename}, ExpiresIn=120)
    print(f"[S3] presigned URL: bucket={bucketname} key={filename}\n  -> {url}")
    return url