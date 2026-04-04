import React, { useState } from "react";
import "./../App.css";
import Editor from "@monaco-editor/react";

export default function Playground() {
  const [code, setCode] = useState(`print("Hello from Python")`);
  const [language, setLanguage] = useState("python");
  
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [loading, setLoading] = useState(false);

  // token wysylany do weryfikacji tozsamosci
  function getAuthHeaders(withJson = false) {
    const token = localStorage.getItem("token");

    return {
      ...(withJson ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    };
  }

  async function runCode() {
    setLoading(true);
    setStdout("");
    setStderr("");

    try {
      const response = await fetch("http://localhost:5000/run", {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ code, language })
      });

      const data = await response.json();
      setStdout(data.stdout || "");
      setStderr(data.stderr || "");
    } catch (err) {
      setStderr("Zapytanie się nie powiodło: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function getDefaultCode(lang) {
    if (lang === "python") {
      return 'print("Hello from Python")';
    }
    if (lang === "java") {
      return `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java");
    }
}`;
    }
    if (lang === "cpp") {
      return `#include <iostream>
using namespace std;

int main() {
    cout << "Hello from C++" << endl;
    return 0;
 }`;
    }
    return "";
  }


  return (
    <main className="main-layout">
      <section className="panel left-panel">
        <div className="panel-header">
          <h2>Kod Programu</h2>

          <div className="controls">
            <select
              className="language-select"
              value={language}
              onChange={(e) => {
                const newLanguage = e.target.value;
                setLanguage(newLanguage);
                setCode(getDefaultCode(newLanguage));
              }}
            >
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>

            <button
              className="run-button"
              onClick={runCode}
              disabled={loading}
            >
              {loading ? "Uruchamianie..." : "Uruchom"}
            </button>
          </div>
        </div>

        <div className="editor-wrapper">
          <Editor
            height="100%"
            theme="vs-dark"
            language={language}
            value={code}
            onChange={(value) => setCode(value || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              automaticLayout: true,
              scrollBeyondLastLine: false
            }}
          />
        </div>
      </section>

      <section className="right-column">
        <div className="panel output-panel">
          <div className="panel-header">
            <h2>Wynik Programu</h2>
          </div>

          <pre className="output-area">
            {stdout || "Tutaj pojawi się wynik programu"}
          </pre>
        </div>

        <div className="panel error-panel">
          <div className="panel-header">
            <h2>Błędy</h2>
          </div>

          <pre className="error-area">
            {stderr || "Brak błędów"}
          </pre>
        </div>
      </section>
    </main>
  );
}