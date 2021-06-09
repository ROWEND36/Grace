package com.tmstudios.grace_editor.vfs;

import com.tmstudios.grace_editor.vfs.*;
import android.webkit.*;
import java.util.*;
import java.nio.charset.*;
import java.io.*;
import android.util.*;
import android.content.*;
import org.apache.commons.io.*;
import com.tmstudios.grace_editor.vcs.*;


public class FileStorage extends VirtualFileSystem
{
	protected JGitVCS jgit;
	
	public FileStorage(WebView web, String root)
	{
		super(web, root);
		jgit = new JGitVCS();
		web.addJavascriptInterface(jgit,"jgit");
		jgit.setWebInterface(this);
	}

	@Override
	public void destroy(){
		super.destroy();
		jgit.dispose();
	}
	@Override
	protected InputStream openReadableStream(String path) throws IOException
	{
		return FileUtils.openInputStream(new File(path));
	}

	@Override
	protected OutputStream openWritableStream(String path) throws IOException
	{
		return FileUtils.openOutputStream(new File(path));
	}


	@Override
	@JavascriptInterface
	public String getEncodings(String accessKey)
	{
		verifyKey(accessKey);
		Map < String, Charset > charsets = Charset.availableCharsets();
		StringWriter a = new StringWriter();
		JsonWriter d = new JsonWriter(a);
		try
		{
			d.beginArray();
			for (Map.Entry < String, Charset > e: charsets.entrySet())
			{
				d.value(e.getKey());
				for (String item: e.getValue().aliases())
				{
					if (!item.equals(e.getKey()))
						d.value(item);
				}
			}
			d.endArray();
			a.flush();
			return a.getBuffer().toString();
		}
		catch (IOException e)
		{
			doError(e, accessKey);
		}
		finally
		{
			try
			{
				if (a != null)
					a.close();
			}
			catch (IOException e)
			{
				doError(e, accessKey);
			}
		}
		return null;
	}

	@Override
	@JavascriptInterface
	public void newFolder(String path, String accessKey)
	{
		verifyKey(accessKey);
		File b = new File(path);
		if (b.exists()) doError(new RuntimeException(ERROR_EEXISTS), accessKey);
		if (!b.getParentFile().exists()) doError(new RuntimeException(ERROR_ENOENT), accessKey);
		b.mkdir();
		if (!b.exists()) doError(new RuntimeException(ERROR_ACCESS), accessKey);

	}

	@Override
	@JavascriptInterface
	public void symlink(String path, String dest, String accessKey)
	{
		verifyKey(accessKey);
		doError(new RuntimeException(ERROR_ACCESS), accessKey);
	}

	@Override
	@JavascriptInterface
	public String readlink(String path, String accessKey)
	{
		verifyKey(accessKey);
		try
		{
			return new File(path).getCanonicalPath();
		}
		catch (IOException e)
		{
			doError(e, accessKey);
		}
		return null;
	}

	@Override
	@JavascriptInterface
	public void rename(String path, String dest, String accessKey)
	{
		verifyKey(accessKey);

		try
		{
			File destFile = new File(dest);
			if (destFile.exists()) throw new RuntimeException(ERROR_EEXISTS);
			File srcFile = new File(path);
			if (!srcFile.exists()) throw new RuntimeException(ERROR_ENOENT);
			srcFile.renameTo(destFile);
		}
		catch (Exception e)
		{
			doError(e, accessKey);
		}
	}

	@Override
	@JavascriptInterface
	public void delete(String path, String accessKey)
	{
		verifyKey(accessKey);
		try
		{
			File file = new File(path);
			if (!file.exists()) throw new RuntimeException(ERROR_ENOENT);
			if (!FileUtils.deleteQuietly(file))
				throw new RuntimeException(ERROR_ACCESS);
		}
		catch (Exception e)
		{
			doError(e, accessKey);
		}
	}

	@Override
	@JavascriptInterface
	public void copyFile(String path, String dest, boolean overwrite, String accessKey)
	{
		verifyKey(accessKey);

		File pack = new File(dest);
		File p = new File(path);
		if (p.isDirectory())
		{
			doError(new RuntimeException(ERROR_EISDIR), accessKey);
		}
		if (!p.exists())
		{
			doError(new RuntimeException(ERROR_ENOENT), accessKey);
		}
		if (!overwrite && pack.exists())
		{
			doError(new RuntimeException(ERROR_EEXISTS), accessKey);
		}
		try
		{
			FileUtils.copyFile(p, pack);
		}
		catch (IOException e)
		{
			doError(e, accessKey);
		}
	}

	@Override
	@JavascriptInterface
	public void moveFile(String path, String dest, boolean overwrite, String accessKey)
	{
		verifyKey(accessKey);

		File pack = new File(dest);
		File p = new File(path);
		if (p.isDirectory())
		{
			doError(new RuntimeException(ERROR_EISDIR), accessKey);
		}
		else if (!p.exists())
		{
			doError(new RuntimeException(ERROR_ENOENT), accessKey);
		}
		if (pack.exists())
		{
			if (!overwrite)
			{
				doError(new RuntimeException(ERROR_EEXISTS), accessKey);
			}
			else pack.delete();
		}
		try
		{
			FileUtils.moveFile(p, pack);
		}
		catch (IOException e)
		{
			doError(e, accessKey);
		}
	}

	@Override
	@JavascriptInterface
	public String stat(String path, boolean isLstat, String accessKey)
	{
		verifyKey(accessKey);

		StringWriter stringWriter = new StringWriter();
		JsonWriter bw = new JsonWriter(stringWriter);
		File p = new File(path);
		String value = null;
		try
		{
			bw.beginObject();
			if (!p.exists())
			{
				doError(new RuntimeException(ERROR_ENOENT), accessKey);
			}
			bw.name("mtimeMs").value(p.lastModified());
			if (p.isFile())
				bw.name("size").value(FileUtils.sizeOf(p));
			else if (p.isDirectory())
			{
				bw.name("size").value(32);
			}
			bw.name("type").value((isLstat && FileUtils.isSymlink(p)) ? "symlink" : p.isDirectory() ? "dir" : "file");
			bw.endObject();
			value = stringWriter.getBuffer().toString();
		}
		catch (IOException e)
		{
			doError(e, accessKey);
		}
		return value;
	};

	@Override
	@JavascriptInterface
	public long sizeOf(String path, String accessKey)
	{
		verifyKey(accessKey);
		File p = new File(path);
		if (!p.exists()) throw new RuntimeException(ERROR_ENOENT);
		return FileUtils.sizeOf(p);
	}

	@Override
	@JavascriptInterface
	public String freeSpace(String path, String accessKey)
	{
		verifyKey(accessKey);
		File p = new File(path);
		if (!p.exists()) throw new RuntimeException(ERROR_ENOENT);
		return String.format("%d/%d", p.getFreeSpace(), p.getTotalSpace());
	}

	@Override
	@JavascriptInterface
	public String getFiles(String path, String accessKey)
	{
		verifyKey(accessKey);

		File b = new File(path);

		if (!b.exists())
		{
			doError(new RuntimeException(ERROR_ENOENT), accessKey);
		}
		if (!b.isDirectory())
		{
			doError(new RuntimeException(ERROR_ENOTDIR), accessKey);
		}
		File[] g = b.listFiles();

		if (g == null)
		{
			doError(new RuntimeException(ERROR_ACCESS), accessKey);
		}
		StringWriter a = new StringWriter();
		JsonWriter d = new JsonWriter(a);
		try
		{
			d.beginArray();
			for (File h: g)
			{

				d.value(h.getName() + (h.isDirectory() ? "/" : ""));
			}
			d.endArray();
			a.flush();
			return a.getBuffer().toString();
		}
		catch (IOException e)
		{
			doError(e, accessKey);
		}
		finally
		{
			try
			{
				if (a != null)
					a.close();
			}
			catch (IOException e)
			{
				doError(e, accessKey);
			}
		}
		return null;
	}
}

