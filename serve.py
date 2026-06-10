import http.server, socketserver, webbrowser, os, sys

sys.stdout.reconfigure(encoding="utf-8")

PORT = 3000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

print(f"mcgen  →  http://localhost:{PORT}")
print("press Ctrl+C to stop\n")
webbrowser.open(f"http://localhost:{PORT}")
with socketserver.TCPServer(("", PORT), Handler) as s:
    try:
        s.serve_forever()
    except KeyboardInterrupt:
        print("stopped.")
