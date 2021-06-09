package com.tmstudios.grace_editor.vfs;

import com.tmstudios.grace_editor.*;
import android.webkit.*;
import java.util.concurrent.*;
import android.os.*;
import android.content.*;
import java.util.*;
import java.io.*;
import android.util.Base64;
import java.nio.charset.*;
import org.json.*;
import android.util.*;
import com.tmstudios.grace_editor.vcs.*;

public abstract class VirtualFileSystem
{
    private WebView web;
    private Exception lastError;
    private ExecutorService executor;
    protected Handler handler;
    private static final String TAG = "Application";
    private String root;
    private boolean requested;
    private Intent intent;
    private String ACCESS_KEY;
    Random random;
    public static final int MAX_FILE_LENGTH = 1024 * 1024 * 50;
    public static final int MAX_CONTENT_LENGTH = 1024 * 1024 * 10;
    public static final int MAX_ACCESS_KEY_RETRIES = 3;
    public static final String ERROR_ENOENT = "File does not exist";
    public static final String ERROR_EISDIR = "File is a directory";
    public static final String ERROR_ENOTDIR = "File is not a directory";
    public static final String ERROR_EEXISTS = "File already exists";
    public static final String ERROR_ENOTEMPTY = "Directory is not empty";
    public static final String ERROR_ACCESS = "Operation failed";
    public static final String ERROR_NOTENCODING = "Unknown encoding";
    public static final String ERROR_TOO_LARGE = "File too large";
	public static final String ERROR_EMFILE = "System Busy";
	public static final String ERROR_NULL_VALUE = " can not be null";
	public static final String ERROR_CLOSED = "Resource closed";
    
	public VirtualFileSystem(WebView web, String root)
	{
        this.web = web;
        this.root = root;
        web.addJavascriptInterface(this, TAG);
        this.handler = new Handler();
        random = new Random();
        this.generateKey();
        executor = Executors.newCachedThreadPool();
	}
	
	@JavascriptInterface
	public String getGitBlobId(String path,String accessKey){
		verifyKey(accessKey);
		try
		{
			return JGitVCS.getObjectOid(this.openReadableStream(path));
		}
		catch (IOException e)
		{
			doError(e,accessKey);
			return null;
		}
	}
	
	public void destroy()
	{
		executor.shutdown();
		try
		{
			executor.awaitTermination(3, TimeUnit.SECONDS);
		}
		catch (InterruptedException e)
		{
			executor.shutdownNow();
		}
		for (ReadAndEncodeStream s:inStreams.values())
		{
			try
			{
				s.close();
			}
			catch (IOException e)
			{

			}
		}
		for (DecodeAndWriteStream s:outStreams.values())
		{
			try
			{
				s.close();
			}
			catch (IOException e)
			{

			}
		}
		this.inStreams.clear();
		this.outStreams.clear();
	}
    private void generateKey()
	{
        requested = false;
        String alphaNum = "Axyz#?:~!BopqrCDEF+zGHIXYZ" +
            "012TUPQRSn%3478JK-LstVW9.," +
            "afghij/k\\lmMNObcd!56euv-/";
        StringBuilder sb = new StringBuilder(16);
        for (int i = 0; i < 16; i++)
		{
            int index = random.nextInt(alphaNum.length());
            sb.append(alphaNum.charAt(index));
        }
        ACCESS_KEY = new String(sb.toString());
    }
    public int reloadCount = MAX_ACCESS_KEY_RETRIES;
    @JavascriptInterface
    public String requestAccessKey()
	{
        if (!requested)
		{
            requested = true;
            reloadCount -= MAX_ACCESS_KEY_RETRIES;
            return ACCESS_KEY;
        }
        //max 3 times if getting the key
        //or just once if not
        //should discourage any malicious code
        else if (reloadCount < MAX_ACCESS_KEY_RETRIES)
		{
            reloadCount += MAX_ACCESS_KEY_RETRIES + 1;
            this.setImmediate(new ValueCallback < String >() {
					@Override
					public void onReceiveValue(String p1)
					{
						VirtualFileSystem.this.reload();
					}
				});

        }
        throw new SecurityException("Key already requested");
    }
    public void setImmediate(final ValueCallback <String> cb)
	{
        handler.post(new Runnable() {
				public void run()
				{
					web.evaluateJavascript("(function(){return 'free'})()", cb);
				}
			});
    }
	public void callWebCallback(final int cb,final JSONArray args,final ValueCallback<String> ret){
		handler.post(new Runnable(){
				@Override
				public void run()
				{
					final String code = TAG + "._callbacks[" + cb + "].apply(" + TAG + "," + args.toString() + ")";
					web.evaluateJavascript(code, ret);
				}
		});
	}
    protected void verifyKey(String key)
	{
        if (!ACCESS_KEY.equals(key))
            throw new SecurityException("Mismatching AccessKey");
    }
    @JavascriptInterface
    public String getError(String accessKey)
	{
        verifyKey(accessKey);
        String result = lastError != null ? lastError.toString() : null;
        lastError = null;
        return result;
    }
    public void doError(Exception e, String accessKey)
	{
        //Uses java reference equality to see if
        //the call is from the webview(synchronous)
        if (this.ACCESS_KEY == accessKey)
		{
			//do nothing
		}
        else lastError = e;
        throw new RuntimeException(e);
    }
	
	public void notifyIntent(Intent intent)
	{
        this.intent = intent;
        web.evaluateJavascript(TAG + "._notifyIntent()", null);
    }
	@JavascriptInterface
	public String getIntent(String accessKey){
		verifyKey(accessKey);
		if(this.intent!=null)
			return openFile(this.intent,this.web.getContext());
		else return null;
	}
	@JavascriptInterface
	public void warnPotentialCrash()
	{
		((MainActivity)web.getContext()).scheduleStop();
	}
	@JavascriptInterface
	public void survivedPotentialCrash()
	{
		((MainActivity)web.getContext()).cancelStop();
	}
    public void webNotify(final String str)
	{
        this.handler.post(new Runnable() {
				public void run()
				{
					web.evaluateJavascript("Modules.Notify.info(\"" + str.replace("\"", "\\\"") + "\")", null);
				}
			});
    }

    public void pause()
	{
        web.evaluateJavascript(TAG + "._pause && " + TAG + "._pause()", null);
    }
    public void resume()
	{
        web.evaluateJavascript(TAG + "._resume && " + TAG + "._resume()", null);
    }
	public void reload()
	{
		this.generateKey();
		web.loadUrl(root);
	}
	
	
	

	/*Don't know where to put this*/
    public String openFile(Intent intent, Context ctx)
	{
        String c = null;
        String name = null, path = null;
        if (intent.getData() == null)
		{
            c = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (c == null)
			{
                webNotify("Unable To Read");
                return null;
            }
        }
        else
		{
            ContentResolver r = ctx.getContentResolver();
            BufferedReader d = null;
            InputStream a = null;
            try
			{
                a = r.openInputStream(intent.getData());
                if (a.available() > MAX_CONTENT_LENGTH)
				{
                    webNotify("File Too Large");
                    return null;
                }
                d = new BufferedReader(new InputStreamReader(a, "utf-8"));
                StringBuffer b = new StringBuffer(a.available());
                int f;
                char [] buf = new char[10000]; 
				while ((f = d.read(buf))>-1)
				{
                    b.append(buf,0,f);
                }
                c = b.toString();
                d.close();
            }
            catch (Exception e)
			{
//                e.printStackTrace(Logg.getP());
                return null;
            }
            finally
			{
                try
				{
                    if (d != null)
                        d.close();
                    if (a != null) a.close();
                }
                catch (Exception e)
				{
                    e.printStackTrace(Logg.getP());
                }
            }
            if (c == null)
			{
                webNotify("Unable To Open File");
                return null;
            }
            path = PathResolver.getPath(ctx, intent.getData());
            name = null;
            if (path != null && path.startsWith("temp:"))
			{
                name = path.substring(4);
                path = null;
            }
        }
        StringWriter g = new StringWriter();
        JsonWriter b = new JsonWriter(g);
        try
		{
            b.beginObject();
            b.name("path").value(path);
            b.name("name").value(name);
            b.name("value").value(c);
            b.endObject();
        }
        catch (IOException e)
		{
//            e.printStackTrace(Logg.getP());
            return null;
        }
        return g.toString();
    }
	
	@JavascriptInterface
    public void runFile(String path, boolean newProcess, String accessKey)
	{
        verifyKey(accessKey);

        Intent i = new Intent();
        i.setClass(web.getContext(), newProcess ? RunActivity.RunNewProcess.class : RunActivity.class);
        i.putExtra("path", path);
        web.getContext().startActivity(i);
    }

    @JavascriptInterface
    public void runFile(String path, String accessKey)
	{
        runFile(path, true, accessKey);
    }
	
	
	@JavascriptInterface
	public int openReadableStream(String path, String accessKey) throws IOException
	{
		verifyKey(accessKey);
		if (inStreams.size() + outStreams.size() > MAX_NUM_STREAMS)
		{
			doError(new RuntimeException("EMFILE"), accessKey);
		}
		inStreams.put(++count, new ReadAndEncodeStream(path));
		return count;
	}

	@JavascriptInterface
	public int openWritableStream(String path, String accessKey) throws IOException
	{
		verifyKey(accessKey);
		if (inStreams.size() + outStreams.size() > MAX_NUM_STREAMS)
		{
			doError(new RuntimeException("EMFILE"), accessKey);
		}
		outStreams.put(++count, new DecodeAndWriteStream(path));
		return count;
	}

	@JavascriptInterface
	public void writeStream(int fd, String content, String accessKey)
	{
		verifyKey(accessKey);
		DecodeAndWriteStream stream = outStreams.get(fd);
		if (content == null)doError(new RuntimeException("content" + ERROR_NULL_VALUE), accessKey);
		if (stream == null)
		{
			doError(new RuntimeException(ERROR_CLOSED), accessKey);
		}
		try
		{
			stream.decodeAndWrite(content);
		}
		catch (IOException e)
		{
			doError(e, accessKey);
		}
	}
	@JavascriptInterface
	public String readStream(int fd, String accessKey)
	{
		verifyKey(accessKey);
		ReadAndEncodeStream stream = inStreams.get(fd);
		if (stream == null)
		{
			doError(new RuntimeException(ERROR_CLOSED), accessKey);
		}
		try
		{
			return stream.readAndEncode(10);//returns 160kb string
		}
		catch (IOException e)
		{
			doError(e, accessKey);
			return null;
		}
	}
	@JavascriptInterface
	public void closeWritableStream(int fd, String accessKey) throws IOException
	{
		verifyKey(accessKey);
		DecodeAndWriteStream stream = outStreams.remove(fd);
		if (stream != null)
		{
			stream.close();
		}
	}
	@JavascriptInterface
	public void closeReadableStream(int fd, String accessKey) throws IOException
	{
		verifyKey(accessKey);
		ReadAndEncodeStream stream = inStreams.remove(fd);
		if (stream != null)
		{
		    stream.close();
		}
	}
    @JavascriptInterface
    public void saveBytes(String path, String content, String accessKey)
	{
        verifyKey(accessKey);
        DecodeAndWriteStream b = null;
        if (content == null) doError(new RuntimeException("content" + ERROR_NULL_VALUE), accessKey);
        try
		{
			b = new DecodeAndWriteStream(path);
            b.decodeAndWrite(content);
            b.close();
            return;
        }

        catch (IOException e)
		{
            lastError = e;
        }
        finally
		{
            if (b != null)
			{
                try
				{
                    b.close();
                }
                catch (IOException e)
				{
                    doError(e, accessKey);
                }
            }

        }
        doError(lastError, accessKey);

    }
    
    @JavascriptInterface
    public String getFile(String path, String encoding, String accessKey)
	{
        verifyKey(accessKey);
        Charset charset = Charset.forName(encoding);
        BufferedReader d = null;
        InputStream stream = null;
        try
		{
            if (charset == null)
			{
                doError(new RuntimeException(ERROR_NOTENCODING + " " + encoding), accessKey);
            }
            File file = new File(path);
            if (file.length() > MAX_FILE_LENGTH) doError(new RuntimeException(ERROR_TOO_LARGE), accessKey);
            stream = this.openReadableStream(path);
            d = new BufferedReader(new InputStreamReader(stream, charset));
            StringBuffer buf = new StringBuffer();
            char[] chars = new char[1024];
            while (true)
			{
                int read = d.read(chars);
                if (read < 0)
				{
                    break;
                }
                buf.append(chars, 0, read);
            }
            return buf.toString();
        }
        catch (IOException e)
		{
            lastError = e;
        }
        finally
		{
            try
			{
                if (d != null)
                    d.close();
                if (stream != null)
                    stream.close();
            }
            catch (IOException e)
			{}

        }
        doError(lastError, accessKey);
        return null;
    }

    @JavascriptInterface
    public void saveFile(String path, String content, String encoding, String accessKey)
	{
        verifyKey(accessKey);
        Charset charset = Charset.forName(encoding);
        Writer b = null;
        if (charset == null)
		{
            doError(new RuntimeException(ERROR_NOTENCODING + " " + encoding), accessKey);
        }
        if (content == null) doError(new RuntimeException("content" + ERROR_NULL_VALUE), accessKey);;
        if (content.length() > MAX_FILE_LENGTH)
            doError(new RuntimeException(ERROR_TOO_LARGE), accessKey);

        try
		{
            b =
                new BufferedWriter(new OutputStreamWriter(this.openWritableStream(path), charset));

            b.write(content);
            return;
        }

        catch (IOException e)
		{
            lastError = e;
        }
        finally
		{
            if (b != null)
			{
                try
				{
                    b.close();
                }
                catch (IOException e)
				{}
            }

        }
        doError(lastError, accessKey);
    }

	@JavascriptInterface
    public abstract void newFolder(String path, String accessKey);

    @JavascriptInterface
    public abstract void symlink(String path, String dest, String accessKey);

	@JavascriptInterface
    public abstract String readlink(String path, String accessKey);

	@JavascriptInterface
    public abstract String getEncodings(String accessKey);

	protected abstract InputStream openReadableStream(String path) throws IOException;
	
	protected abstract OutputStream openWritableStream(String path) throws IOException;
	
    @JavascriptInterface
    public abstract void rename(String path, String dest, String accessKey);

    @JavascriptInterface
    public abstract void delete(String path, String accessKey);

    @JavascriptInterface
    public abstract void copyFile(String path, String dest, boolean overwrite, String accessKey);
	
    @JavascriptInterface
    public abstract void moveFile(String path, String dest, boolean overwrite, String accessKey);
	
    @JavascriptInterface
    public abstract String stat(String path, boolean isLstat, String accessKey);
	
    @JavascriptInterface
    public abstract long sizeOf(String path, String accessKey);
   
	@JavascriptInterface
    public abstract String freeSpace(String path, String accessKey);
	
	@JavascriptInterface
    public abstract String getFiles(String path, String accessKey);
	
	/*Raw Byte Operations using base64 as intermediary*/
    private static final int BASE_64_FLAGS = Base64.DEFAULT | Base64.NO_WRAP;
    private static final int CHUNK_SIZE = 1024 * 12; //multiple of 3*4 for both (en/de)coding
	public HashMap<Integer,DecodeAndWriteStream> outStreams = new HashMap<Integer,DecodeAndWriteStream>();
	public HashMap<Integer,ReadAndEncodeStream> inStreams = new HashMap<Integer,ReadAndEncodeStream>();
	public int count = 0;
	public int MAX_NUM_STREAMS = 10;
    public class DecodeAndWriteStream extends BufferedOutputStream
	{
		public StringBuffer waiting;

		public DecodeAndWriteStream(String path) throws IOException
		{
			super(
                new BufferedOutputStream(openWritableStream(path)));
			waiting = new StringBuffer();
		}
		public void writeEncodedContent(String content) throws IOException
		{
			if (waiting.length() > 0 || content.length() % CHUNK_SIZE != 0)
			{
				waiting.append(content);
				int current = waiting.length();
				if (current > CHUNK_SIZE)
				{
					int offset = current - (current % CHUNK_SIZE);
					String toWrite = waiting.substring(0, offset);
					this.decodeAndWrite(toWrite);
				}
			}
			else this.decodeAndWrite(content);
		}
		public void decodeAndWrite(String src) throws IOException
		{
			byte[] bytes = src.getBytes();
			for (int i = 0;; i += CHUNK_SIZE)
			{
                int length = bytes.length - i;
                if (length < CHUNK_SIZE)
				{
                    this.write(Base64.decode(bytes, i, length, BASE_64_FLAGS));
                    break;
                }
                else this.write(Base64.decode(bytes, i, CHUNK_SIZE, BASE_64_FLAGS));
            }
		}

		@Override
		public void close() throws IOException
		{
		    if (waiting != null)
			{
		        String remaining = waiting.toString();
		        this.decodeAndWrite(remaining);
		        waiting = null;
		    }
			super.close();
		}
	}
	public class ReadAndEncodeStream extends BufferedInputStream
	{
		public ReadAndEncodeStream(String path) throws IOException
		{
			super(
                new BufferedInputStream(VirtualFileSystem.this.openReadableStream(path)));
		}
		public String readAndEncode() throws IOException
		{
		    return this.readAndEncode(1000000);
		}
		public String readAndEncode(int numChunks) throws IOException
		{
			StringBuffer c = new StringBuffer();
			//this reads 12kb of bytes and encodes to 16kb of base64
			byte[] buf = new byte[CHUNK_SIZE];
			while (numChunks != 0 && this.available() > 0)
			{
				numChunks--;
				int len = this.read(buf);
				c.append(Base64.encodeToString(buf, 0, len, BASE_64_FLAGS));
			}
			return c.toString();
		}
	}
	@JavascriptInterface
    public String getBytes(String path, String accessKey)
	{
        verifyKey(accessKey);

        ReadAndEncodeStream inputStream = null;
        File file = new File(path);
        if (file.length() > MAX_FILE_LENGTH)
            doError(new RuntimeException(ERROR_TOO_LARGE), accessKey);

        try
		{
            inputStream = new ReadAndEncodeStream(path);
            return inputStream.readAndEncode();
        }
        catch (IOException e)
		{
            doError(e, accessKey);
        }
        finally
		{
            try
			{
                if (inputStream != null)
                    inputStream.close();
            }
            catch (IOException e)
			{}

        }
        return null;
    }
	
    @JavascriptInterface
    public void getFilesAsync(String path, int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new ListFilesTask(this, path, this, callback));
    }
    @JavascriptInterface
    public void getFileAsync(String path, String encoding, int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new GetFileTask(this, path, encoding, this, callback));
    }
    @JavascriptInterface
    public void getBytesAsync(final String path, int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new FileTask < String >(this, callback) {
				public String execute()
				{
					return VirtualFileSystem.this.getBytes(path, ACCESS_KEY);
				}
			});
    }
    @JavascriptInterface
    public void saveBytesAsync(final String path, final String content, int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new FileTask < Void >(this, callback) {
				public Void execute()
				{
					VirtualFileSystem.this.saveBytes(path, content, ACCESS_KEY);
					return null;
				}
			});
    }
    @JavascriptInterface
    public void moveFileAsync(final String path, final String dest, final boolean overwrite, int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new FileTask < Void >(this, callback) {
				public Void execute()
				{
					VirtualFileSystem.this.moveFile(path, dest, overwrite, ACCESS_KEY);
					return null;
				}
			});
    }
    @JavascriptInterface
    public void copyFileAsync(final String path, final String dest, final boolean overwrite, int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new FileTask < Void >(this, callback) {
				public Void execute()
				{
					VirtualFileSystem.this.copyFile(path, dest, overwrite, ACCESS_KEY);
					return null;
				}
			});
    }
    @JavascriptInterface
    public void saveFileAsync(final String path, final String dest, final String encoding, int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new FileTask < Void >(this, callback) {
				public Void execute()
				{
					VirtualFileSystem.this.saveFile(path, dest, encoding, ACCESS_KEY);
					return null;
				}
			});
    }
    @JavascriptInterface
    public void writeStreamAsync(final int fd, final String content, int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new FileTask < Void >(this, callback) {
				public Void execute()
				{
					VirtualFileSystem.this.writeStream(fd, content, ACCESS_KEY);
					return null;
				}
			});
    }
    @JavascriptInterface
    public void readStreamAsync(final int fd, final int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new FileTask < String >(this, callback) {
				public String execute()
				{
					return VirtualFileSystem.this.readStream(fd, ACCESS_KEY);
				}
			});
    }

    @JavascriptInterface
    public void sizeOfAsync(final String path, int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new FileTask < Long >(this, callback) {
				public Long execute()
				{
					return VirtualFileSystem.this.sizeOf(path, ACCESS_KEY);
				}
			});
    }
    @JavascriptInterface
    public void getGitBlobIdAsync(final String path, int callback, String accessKey)
	{
        verifyKey(accessKey);
        executor.submit(new FileTask < String >(this, callback) {
				public String execute()
				{
					return VirtualFileSystem.this.getGitBlobId(path, ACCESS_KEY);
				}
			});
    }
    private abstract static class FileTask < T > implements Runnable
	{
        int callback;
        VirtualFileSystem vfs;
        public FileTask(VirtualFileSystem vfs, int c)
		{
            callback = c;
            this.vfs = vfs;
        }
        public abstract T execute()
        @Override
        public void run()
		{
            JSONArray b = new JSONArray();
            try
			{
                T res = this.execute();
                b.put(1, res);

            }
            catch (Exception e)
			{
                try
				{
                    b.put(0, e.toString());
                }
                catch (Exception f)
				{
                    f.printStackTrace();
                }
            }

            vfs.callWebCallback(callback,b,null);
        }
    }
    private static class ListFilesTask extends FileTask < String >
	{
        String path;
        VirtualFileSystem app;
        public ListFilesTask(VirtualFileSystem ap, String pah, VirtualFileSystem v, int c)
		{
            super(v, c);
            app = ap;
            path = pah;
        }
        public String execute()
		{
            return app.getFiles(path, app.ACCESS_KEY);
        }
    }
    private static class GetFileTask extends FileTask < String >
	{
        VirtualFileSystem app;
        String path,
        encoding;
        public GetFileTask(VirtualFileSystem i, String p, String e, VirtualFileSystem v, int c)
		{
            super(v, c);
            app = i;
            path = p;
            encoding = e;
        }
        public String execute()
		{
            return app.getFile(path, encoding, app.ACCESS_KEY);
        }
    }
	
}
