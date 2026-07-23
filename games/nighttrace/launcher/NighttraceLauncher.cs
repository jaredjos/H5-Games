using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

internal static class NighttraceLauncher
{
    private const int Port = 41731;
    private static readonly string Url = "http://127.0.0.1:" + Port + "/";
    private static string distRoot = string.Empty;
    private static TcpListener server;
    private static volatile bool running = true;
    private static bool openOnStart = true;

    [STAThread]
    private static int Main(string[] args)
    {
        for (int index = 0; index < args.Length; index++)
        {
            if (args[index].Equals("--no-open", StringComparison.OrdinalIgnoreCase))
            {
                openOnStart = false;
            }
        }

        Console.Title = "NIGHTTRACE";
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine();
        Console.WriteLine("  NIGHTTRACE");
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.WriteLine("  Draw the path. Burn the horde.");
        Console.WriteLine();

        distRoot = Path.GetFullPath(
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dist")
        );

        if (!File.Exists(Path.Combine(distRoot, "index.html")))
        {
            return Fail(
                "The production game files were not found.\n" +
                "Keep this launcher beside the dist folder."
            );
        }

        try
        {
            server = new TcpListener(IPAddress.Loopback, Port);
            server.Start();
        }
        catch (SocketException)
        {
            Console.WriteLine("  NIGHTTRACE already appears to be running.");
            if (openOnStart)
            {
                Console.WriteLine("  Opening the existing game...");
                OpenBrowser();
            }
            Thread.Sleep(900);
            return 0;
        }

        Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs eventArgs)
        {
            eventArgs.Cancel = true;
            StopServer();
        };

        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("  READY");
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.WriteLine("  " + Url);
        Console.WriteLine();
        Console.WriteLine("  Keep this window open while playing.");
        Console.WriteLine("  Close it or press Ctrl+C to stop NIGHTTRACE.");
        Console.WriteLine();

        if (openOnStart)
        {
            OpenBrowser();
        }

        while (running)
        {
            try
            {
                TcpClient client = server.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(HandleClient, client);
            }
            catch (SocketException)
            {
                if (running)
                {
                    StopServer();
                }
            }
            catch (ObjectDisposedException)
            {
                break;
            }
        }

        return 0;
    }

    private static void HandleClient(object state)
    {
        TcpClient client = state as TcpClient;
        if (client == null)
        {
            return;
        }

        using (client)
        using (NetworkStream stream = client.GetStream())
        using (StreamReader reader = new StreamReader(
            stream,
            Encoding.ASCII,
            false,
            1024,
            true
        ))
        {
            try
            {
                string requestLine = reader.ReadLine();
                if (string.IsNullOrWhiteSpace(requestLine))
                {
                    return;
                }

                string header;
                do
                {
                    header = reader.ReadLine();
                }
                while (!string.IsNullOrEmpty(header));

                string[] requestParts = requestLine.Split(' ');
                if (requestParts.Length < 2)
                {
                    WriteError(stream, 400, "Bad Request");
                    return;
                }

                string method = requestParts[0].ToUpperInvariant();
                if (method != "GET" && method != "HEAD")
                {
                    WriteError(stream, 405, "Method Not Allowed");
                    return;
                }

                string filePath;
                int status;
                string statusText;
                ResolveRequestPath(requestParts[1], out filePath, out status, out statusText);

                if (status != 200 || !File.Exists(filePath))
                {
                    WriteError(stream, status, statusText);
                    return;
                }

                FileInfo info = new FileInfo(filePath);
                string cacheControl = GetCacheControl(filePath);

                string responseHeaders =
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: " + GetMimeType(filePath) + "\r\n" +
                    "Content-Length: " + info.Length + "\r\n" +
                    "Cache-Control: " + cacheControl + "\r\n" +
                    "X-Content-Type-Options: nosniff\r\n" +
                    "Connection: close\r\n\r\n";

                byte[] headerBytes = Encoding.ASCII.GetBytes(responseHeaders);
                stream.Write(headerBytes, 0, headerBytes.Length);

                if (method == "GET")
                {
                    using (FileStream file = File.OpenRead(filePath))
                    {
                        file.CopyTo(stream);
                    }
                }
            }
            catch
            {
                // A browser may cancel asset requests during navigation. The next
                // request remains unaffected, so there is nothing useful to report.
            }
        }
    }

    private static void ResolveRequestPath(
        string requestTarget,
        out string filePath,
        out int status,
        out string statusText
    )
    {
        status = 200;
        statusText = "OK";

        int queryIndex = requestTarget.IndexOf('?');
        if (queryIndex >= 0)
        {
            requestTarget = requestTarget.Substring(0, queryIndex);
        }

        string relativePath;
        try
        {
            relativePath = Uri.UnescapeDataString(requestTarget)
                .Replace('/', Path.DirectorySeparatorChar)
                .TrimStart(Path.DirectorySeparatorChar);
        }
        catch (UriFormatException)
        {
            filePath = string.Empty;
            status = 400;
            statusText = "Bad Request";
            return;
        }

        if (string.IsNullOrEmpty(relativePath))
        {
            relativePath = "index.html";
        }

        filePath = Path.GetFullPath(Path.Combine(distRoot, relativePath));
        string safeRoot = distRoot.TrimEnd(Path.DirectorySeparatorChar) +
            Path.DirectorySeparatorChar;

        if (
            !filePath.StartsWith(safeRoot, StringComparison.OrdinalIgnoreCase) &&
            !filePath.Equals(distRoot, StringComparison.OrdinalIgnoreCase)
        )
        {
            filePath = string.Empty;
            status = 403;
            statusText = "Forbidden";
            return;
        }

        if (Directory.Exists(filePath))
        {
            filePath = Path.Combine(filePath, "index.html");
        }

        if (!File.Exists(filePath))
        {
            if (string.IsNullOrEmpty(Path.GetExtension(relativePath)))
            {
                filePath = Path.Combine(distRoot, "index.html");
            }
            else
            {
                status = 404;
                statusText = "Not Found";
            }
        }
    }

    private static string GetCacheControl(string path)
    {
        string fileName = Path.GetFileName(path);
        string extension = Path.GetExtension(path);
        bool isMutableAppEntry =
            fileName.Equals("index.html", StringComparison.OrdinalIgnoreCase) ||
            fileName.Equals("sw.js", StringComparison.OrdinalIgnoreCase) ||
            fileName.Equals("manifest.webmanifest", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith(
                Path.Combine(".vite", "manifest.json"),
                StringComparison.OrdinalIgnoreCase
            );
        if (isMutableAppEntry)
        {
            return "no-cache";
        }

        bool isFingerprintedBuildAsset =
            (extension.Equals(".js", StringComparison.OrdinalIgnoreCase) ||
             extension.Equals(".css", StringComparison.OrdinalIgnoreCase)) &&
            fileName.Contains("-");

        return isFingerprintedBuildAsset
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600, must-revalidate";
    }

    private static string GetMimeType(string path)
    {
        switch (Path.GetExtension(path).ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".js":
            case ".mjs": return "text/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".json":
            case ".map": return "application/json; charset=utf-8";
            case ".webmanifest": return "application/manifest+json; charset=utf-8";
            case ".png": return "image/png";
            case ".jpg":
            case ".jpeg": return "image/jpeg";
            case ".webp": return "image/webp";
            case ".svg": return "image/svg+xml";
            case ".ico": return "image/x-icon";
            case ".woff": return "font/woff";
            case ".woff2": return "font/woff2";
            case ".mp3": return "audio/mpeg";
            case ".ogg": return "audio/ogg";
            case ".wav": return "audio/wav";
            default: return "application/octet-stream";
        }
    }

    private static void WriteError(NetworkStream stream, int status, string statusText)
    {
        byte[] body = Encoding.UTF8.GetBytes(
            "<!doctype html><meta charset=\"utf-8\"><title>NIGHTTRACE</title>" +
            "<body style=\"background:#03080d;color:#efe8d8;font-family:Segoe UI;padding:40px\">" +
            "<h1>NIGHTTRACE</h1><p>" + status + " " + statusText + "</p></body>"
        );

        string headers =
            "HTTP/1.1 " + status + " " + statusText + "\r\n" +
            "Content-Type: text/html; charset=utf-8\r\n" +
            "Content-Length: " + body.Length + "\r\n" +
            "Connection: close\r\n\r\n";

        byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
        stream.Write(headerBytes, 0, headerBytes.Length);
        stream.Write(body, 0, body.Length);
    }

    private static void OpenBrowser()
    {
        try
        {
            Process.Start(new ProcessStartInfo(Url) { UseShellExecute = true });
        }
        catch
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("  Open this address manually: " + Url);
            Console.ForegroundColor = ConsoleColor.Gray;
        }
    }

    private static void StopServer()
    {
        if (!running)
        {
            return;
        }

        running = false;
        try
        {
            server.Stop();
        }
        catch
        {
        }
    }

    private static int Fail(string message)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine("  Could not start NIGHTTRACE.");
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.WriteLine();
        Console.WriteLine("  " + message.Replace("\n", "\n  "));
        Console.WriteLine();
        Console.WriteLine("  Press any key to close.");
        Console.ReadKey(true);
        return 1;
    }
}
