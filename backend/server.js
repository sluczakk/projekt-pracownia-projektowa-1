const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: "50kb" }));

const SECRET_KEY = "sekretnyklucz";

app.use(express.static(path.join(__dirname, "public")));

// baza danych sqlite3

const dbPath = process.env.DATABASE_PATH || "/home/data/database.sqlite";

fs.mkdirSync("/home/data", { recursive: true });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("DB error:", err.message);
  } else {
    console.log("Connected to SQLite DB");
  }
});

// tworzymy tabele z uzytkownikami
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT
    )
  `);
});

// ======== konta uzytkownikow ========

// rejestracja
app.post("/auth/register", async (req, res) => {
  const { email, password, repeatedpassword } = req.body;

  if (password !== repeatedpassword) {
    return res.status(400).json({ message: "Hasła nie pasują" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (email, password) VALUES (?, ?)`,
    [email, hashedPassword],
    function (err) {
      if (err) {
        return res.status(400).json({ message: "Email już istnieje" });
      }

      const user = {
        id: this.lastID,
        email,
      };

      const token = jwt.sign(user, SECRET_KEY, { expiresIn: "7d" });

      res.json({ token, user });
    }
  );
});

// logowanie
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (!user) {
      return res.status(401).json({ message: "Nie istnieje konto z podanym emailem" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Złe hasło" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  });
});

// weryfikacja tokena
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ message: "Brak tokenu" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Nieprawidłowy token" });
  }
}

app.get("/auth/verifytoken", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});


// ======== odpalanie kodu ========

const MAX_STDOUT = 5000;

const memorylimit = "64m";
const cpuslimit = "0.5";
const securityopt = "no-new-privileges";
const pidslimit = "64";

function cleanupJobDir(jobDir) {
  setTimeout(() => {
    fs.rm(jobDir, { recursive: true, force: true }, () => {});
  }, 200);
}

app.post("/run", (req, res) => {
  const code = req.body?.code; // Przesłany kod
  const language = req.body?.language; // Wybrany język

  let stdout = " "; // Zwracane wartości
  let stderr = " "; // Zwracane błędy
  let returncode = 0;
  let finished = false;

  const finish = (payload) => {
      if (!finished) {
        finished = true;
        res.json(payload);
      }
    };

  if (language == "python") {
    // kazdy request dostaje inny folder
    const jobId = crypto.randomUUID();
    const jobDir = path.join(__dirname, "temp", jobId);

    fs.mkdirSync(jobDir, { recursive: true });
    fs.writeFileSync(path.join(jobDir, "main.py"), code);

    // Uruchamiamy kontener Dockera z pythonem
    const mountArg =
      process.platform === "win32"
        ? `${jobDir.replace(/\\/g, "/")}:/app`
        : `${jobDir}:/app`;

    const containerName = `job-${jobId}`;

    const python_process = spawn("docker", [
      "run",
      "--rm",
      "--name", containerName,

      "--network", "none",             // brak internetu
      "--memory", memorylimit,         // limit RAM
      "--cpus", cpuslimit,             // limit CPU

      "--security-opt", securityopt,
      "--pids-limit", pidslimit,
      "--read-only",

      "-v", mountArg,                  // folder z plikiem, z którego czytamy

      "runcode-python"                 // nazwa image dockera
    ]);

    /*const timeout = setTimeout(() => {
      python_process.kill("SIGKILL");
      finish({
        stdout,
        stderr: "Timeout",
        returncode: -1
      });
    }, 5000); // 5 sekund*/

    const timeout = setTimeout(() => {
      spawn("docker", ["kill", containerName]); 
      cleanupJobDir(jobDir);
      finish({
        stdout,
        stderr: "Timeout",
        returncode: -1
      });
    }, 5000); // timeout kontenera 5 sekund

    python_process.stdout.on("data", (data) => {
      stdout += data.toString();

      if (stdout.length > MAX_STDOUT) {
        cleanupJobDir(jobDir);
        spawn("docker", ["kill", containerName]);
        finish({
          stdout: " ",
          stderr: "stdout too long",
          returncode: -1
        });
      }
    });

    python_process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python_process.on("error", (err) => {
      cleanupJobDir(jobDir);
      finish({
        stdout: "",
        stderr: `Failed to start Docker: ${err.message}`,
        returncode: -1
      });
    });

    python_process.on("close", (exitCode) => {
      cleanupJobDir(jobDir);
      finish({ stdout, stderr, exitCode });
      return;
    });
  }
  else if (language == "java") {
    if (!code.includes("class Main ")) {
      stderr = 'Code must contain "class Main"',
      finish({ stdout, stderr, returncode: -1 });
      return;
    }

    // kazdy request dostaje inny folder
    const jobId = crypto.randomUUID();
    const jobDir = path.join(__dirname, "temp", jobId);

    fs.mkdirSync(jobDir, { recursive: true });
    fs.writeFileSync(path.join(jobDir, "Main.java"), code);

    // etap kompilacji
    const compile = spawn("javac", ["Main.java"], {
      cwd: jobDir,
    });
    
    const compiletimeout = setTimeout(() => {
    compile.kill("SIGKILL");
      finish({
        stdout,
        stderr: "Timeout",
        returncode: -1
      });
    }, 3000); // 3 sekundy

    compile.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    compile.on("close", (exitCode) => {
      if (exitCode !== 0) {
        setTimeout(() => {
          fs.rm(jobDir, { recursive: true, force: true }, () => {}); // usuwamy folder z requestem
        }, 200); 
        clearTimeout(compiletimeout);
        finish({ stdout, stderr, exitCode });
        return;
      }

      // uruchom plik
      const java_process = spawn("java", ["Main"], {
        cwd: jobDir,
      });

      const runtimeout = setTimeout(() => {
      java_process.kill("SIGKILL");
        finish({
          stdout,
          stderr: "Timeout",
          returncode: -1
        });
      }, 3000); // 3 sekundy

      // wynik kodu
      java_process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      // Błędy
      java_process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      java_process.on("close", (exitCode) => {
          setTimeout(() => {
            fs.rm(jobDir, { recursive: true, force: true }, () => {}); // usuwamy folder z requestem
          }, 200); 
        clearTimeout(runtimeout);
        finish({ stdout, stderr, exitCode });
        return;
      });
    });
  }
  else if (language == "cpp") {
    // kazdy request dostaje inny folder
    const jobId = crypto.randomUUID();
    const jobDir = path.join(__dirname, "temp", jobId);

    fs.mkdirSync(jobDir, { recursive: true });
    fs.writeFileSync(path.join(jobDir, "main.cpp"), code);

    // etap kompilacji
    const compile = spawn("g++", ["main.cpp", "-o", "main"], {
      cwd: jobDir,
    });

    const compiletimeout = setTimeout(() => {
    compile.kill("SIGKILL");
      finish({
        stdout,
        stderr: "Timeout",
        returncode: -1
      });
    }, 3000); // 3 sekundy

    compile.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    compile.on("close", (exitCode) => {
      if (exitCode !== 0) {
        setTimeout(() => {
          fs.rm(jobDir, { recursive: true, force: true }, () => {}); // usuwamy folder z requestem
        }, 200); 
        clearTimeout(compiletimeout);
        finish({ stdout, stderr, exitCode });
        return;
      }

      // uruchom plik
      const cpp_process = spawn(
        process.platform === "win32" ? "main.exe" : "./main",
        [],
        { cwd: jobDir }
      );

      const runtimeout = setTimeout(() => {
      cpp_process.kill("SIGKILL");
        finish({
          stdout,
          stderr: "Timeout",
          returncode: -1
        });
      }, 3000); // 3 sekundy

      // wynik kodu
      cpp_process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      // Błędy
      cpp_process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      cpp_process.on("close", (exitCode) => {
          setTimeout(() => {
            fs.rm(jobDir, { recursive: true, force: true }, () => {}); // usuwamy folder z requestem
          }, 200); 
        clearTimeout(runtimeout);
        finish({ stdout, stderr, exitCode });
        return;
      });
    });
  }
  else {
    finish({stdout, stderr, returncode: -1});
  }

  return;

})

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});