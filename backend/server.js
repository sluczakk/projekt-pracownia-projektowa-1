const express = require("express");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: "50kb" }));

app.post("/run", (req, res) => {
  const code = req.body?.code; // Przesłany kod
  const language = req.body?.language; // Wybrany język

  let stdout = ""; // Zwracane wartości
  let stderr = ""; // Zwracane błędy
  let returncode = 0;
  let finished = false;

  const finish = (payload) => {
      if (finished) return;
      finished = true;
      res.json(payload);
    };

  if (language == "python") {
    // Uruchamiamy Pythona
    const process = spawn("python", ["-c", code]);

    // Wynik kodu
    process.stdout.on("data", (data) => {
      //console.log("STDOUT:", data.toString());
      stdout += data.toString();
    });

    // Błędy
    process.stderr.on("data", (data) => {
      //console.log("STDERR:", data.toString());
      stderr += data.toString();
    });

    // Odpowiedź do klienta po zakończeniu procesu
    process.on("close", (exitCode) => {
      //console.log("Proces pythona zakończony. ", exitCode);
      finish({ stdout, stderr, exitCode });
    });

  }
  else if (language == "java") {

    finish({stdout, stderr, returncode: -1});
  }
  else if (language == "cpp") {

    finish({stdout, stderr, returncode: -1});
  }
  else {
    finish({stdout, stderr, returncode: -1});
  }

})
/*
  if (typeof code !== "string") {
    return res.status(400).json({
      stdout: "",
      stderr: "Invalid request: code must be a string.",
      returncode: -1
    });
  }

  const tempFile = path.join(
    os.tmpdir(),
    `python-runner-${Date.now()}-${Math.random().toString(36).slice(2)}.py`
  );

  fs.writeFile(tempFile, code, (writeErr) => {
    if (writeErr) {
      return res.status(500).json({
        stdout: "",
        stderr: "Failed to create temp file.",
        returncode: -1
      });
    }

    const python = spawn("python", [tempFile], {
      shell: false
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const cleanup = () => {
      fs.unlink(tempFile, () => {});
    };

    const finish = (payload) => {
      if (finished) return;
      finished = true;
      cleanup();
      res.json(payload);
    };

    const timer = setTimeout(() => {
      python.kill("SIGKILL");
      finish({
        stdout,
        stderr: stderr || "Execution timed out.",
        returncode: -1
      });
    }, 3000);

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("error", (err) => {
      clearTimeout(timer);
      finish({
        stdout: "",
        stderr: `Failed to start Python: ${err.message}`,
        returncode: -1
      });
    });

    python.on("close", (code) => {
      clearTimeout(timer);
      finish({
        stdout,
        stderr,
        returncode: code ?? 0
      });
    });
  });
});*/

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});