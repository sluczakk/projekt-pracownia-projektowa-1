PYTHON 

budowanie image dockera
docker build -t code-runner-python ./runner-images/python

odpalanie dockera z plikiem
docker run --rm ^ --network none ^ --memory 128m ^ --cpus 0.5 ^ -v "%cd%/temp-run:/app" ^ code-runner-python