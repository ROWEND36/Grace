package com.tmstudios.grace_editor;
import android.webkit.*;
import com.tmstudios.grace_editor.vfs.*;
import java.io.*;

public class FtpServer extends VirtualFileSystem
{

	@Override
	public void newFolder(String path, String accessKey)
	{
		// TODO: Implement this method
	}

	@Override
	public void symlink(String path, String dest, String accessKey)
	{
		// TODO: Implement this method
	}

	@Override
	public String readlink(String path, String accessKey)
	{
		// TODO: Implement this method
		return null;
	}

	@Override
	public String getEncodings(String accessKey)
	{
		// TODO: Implement this method
		return null;
	}

	@Override
	protected InputStream openReadableStream(String path) throws IOException
	{
		// TODO: Implement this method
		return null;
	}

	@Override
	protected OutputStream openWritableStream(String path) throws IOException
	{
		// TODO: Implement this method
		return null;
	}

	@Override
	public void rename(String path, String dest, String accessKey)
	{
		// TODO: Implement this method
	}

	@Override
	public void delete(String path, String accessKey)
	{
		// TODO: Implement this method
	}

	@Override
	public void copyFile(String path, String dest, boolean overwrite, String accessKey)
	{
		// TODO: Implement this method
	}

	@Override
	public void moveFile(String path, String dest, boolean overwrite, String accessKey)
	{
		// TODO: Implement this method
	}

	@Override
	public String stat(String path, boolean isLstat, String accessKey)
	{
		// TODO: Implement this method
		return null;
	}

	@Override
	public long sizeOf(String path, String accessKey)
	{
		// TODO: Implement this method
		return 0;
	}

	@Override
	public String freeSpace(String path, String accessKey)
	{
		// TODO: Implement this method
		return null;
	}

	@Override
	public String getFiles(String path, String accessKey)
	{
		// TODO: Implement this method
		return null;
	}
	
	public FtpServer(WebView web,String root){
		super(web,root);
	}
}
