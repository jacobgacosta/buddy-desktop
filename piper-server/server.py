import subprocess
from fastapi import FastAPI
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI()

class TTSRequest(BaseModel):
    text: str

@app.post("/tts")
def tts(req: TTSRequest):
    result = subprocess.run(
        ["/usr/local/piper/piper", "--model", "/voices/es.onnx", "--output_file", "-", "--quiet"],
        input=req.text.encode("utf-8"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        return Response(status_code=500, content=result.stderr)
    return Response(content=result.stdout, media_type="audio/wav")
