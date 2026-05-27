import json
import os
from datetime import datetime

images=[]

for file in sorted(os.listdir("data")):

    if file.lower().endswith(
        (".jpg",".jpeg",".png",".webp",".gif")
    ):

        images.append(f"data/{file}")

manifest={
    "generated_at":
        datetime.now().isoformat()+"Z",
    "images":images
}

with open("manifest.json","w") as f:
    json.dump(manifest,f,indent=2)