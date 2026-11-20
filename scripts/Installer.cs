using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

internal static class Installer
{
    public static string InstallFiles(string folder, string desktop)
    {
        Directory.CreateDirectory(folder);
        string app = Path.Combine(folder, "Relogio Lemos.html");
        string temp = Path.Combine(folder, Path.GetRandomFileName());
        try
        {
            using (Stream resource = typeof(Installer).Assembly.GetManifestResourceStream("app.gz"))
            using (var input = new GZipStream(resource, CompressionMode.Decompress))
            using (var output = File.Create(temp))
                input.CopyTo(output);
            if (File.Exists(app)) File.Replace(temp, app, null);
            else File.Move(temp, app);
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }

        dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        dynamic link = shell.CreateShortcut(Path.Combine(desktop, "Relogio Lemos.lnk"));
        link.TargetPath = app;
        link.Save();
        return app;
    }

    [STAThread]
    private static void Main()
    {
        try
        {
            string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Relogio Lemos");
            string app = InstallFiles(folder, Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
            Process.Start(new ProcessStartInfo(app) { UseShellExecute = true });
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Instalação do Relógio Lemos", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
