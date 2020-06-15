package com.tmstudios.shunt;

import android.app.*;
import android.content.*;
import android.os.*;
import android.util.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import android.content.res.*;
import android.graphics.Color;
import android.database.*;
import android.view.GestureDetector.*;
import android.view.ViewGroup.*;
import java.util.*;
import com.tmstudios.shunt.MainActivity.*;
import android.database.sqlite.*;
import android.net.*;
import android.annotation.*;
import java.nio.charset.*;
import org.apache.commons.io.FileUtils;
public class MainActivity extends Activity 
{

	public WebView web;
	private double lastBackPressed;
    @Override
    protected void onCreate(Bundle savedInstanceState)
    {
        super.onCreate(savedInstanceState);
		web = new WebView(this);
        setContentView(web);
		web.setWebViewClient(new B());
		web.addJavascriptInterface(new Application(web), "Application");
		web.addJavascriptInterface(AppStorage.getInstance(getApplicationContext()), "appStorage");
		WebSettings b =web.getSettings();
		b.setAllowFileAccess(true);
		b.setAllowContentAccess(true);
		b.setAllowFileAccessFromFileURLs(true);
		b.setJavaScriptEnabled(true);
		b.setAllowUniversalAccessFromFileURLs(true);
		b.setBlockNetworkLoads(false);
		b.setDomStorageEnabled(true);
		web.setWebChromeClient(new C(this));
		web.loadUrl("file:///android_asset/shunt/index.html");
	}

	public static class B extends WebViewClient
	{

		@Override
		public boolean shouldOverrideUrlLoading(WebView view, String url)
		{
			// TODO: Implement this method
			Log.e("url", url);
			return super.shouldOverrideUrlLoading(view, url);
		}

		@Override
		public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request)
		{
			// TODO: Implement this method
			Log.e("url", request.getUrl().toString());
			return super.shouldInterceptRequest(view, request);
		}

		public class WebClient extends WebViewClient
		{

			@Override
			@TargetApi(Build.VERSION_CODES.M)
			public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error)
			{
				super.onReceivedError(view, request, error);
				final Uri uri = request.getUrl();
				handleError(view, error.getErrorCode(), error.getDescription().toString(), uri);
			}

			@SuppressWarnings("deprecation")
			public void onReceivedError(WebView view, int errorCode, String description, String failingUrl)
			{
				super.onReceivedError(view, errorCode, description, failingUrl);
				final Uri uri = Uri.parse(failingUrl);
				handleError(view, errorCode, description, uri);
			}

			private void handleError(WebView view, int errorCode, String description, final Uri uri)
			{
				final String host = uri.getHost();// e.g. "google.com"
				final String scheme = uri.getScheme();// e.g. "https"
				Toast.makeText(view.getContext(), description, Toast.LENGTH_LONG).show();
			}
		}
	}

	@Override
	protected void onPause()
	{
		// TODO: Implement this method
		super.onPause();
	}

	@Override
	protected void onDestroy()
	{
		// TODO: Implement this method
		AppStorage.getInstance(getApplicationContext()).close();
		super.onDestroy();
	}

	static class Application
	{
		/*todo return errors*/

		private WebView web;
		public Application(WebView web)
		{
			this.web = web;
		}
		@JavascriptInterface
		public boolean newFolder(String path)
		{
			try
			{
				File b = new File(path);
				b.mkdir();
				return true;
			}
			catch (Exception e)
			{
				return false;
			}
		}
		@JavascriptInterface
		public String getFile(String path)
		{
			return getFile(path, "utf-8");
		}
		@JavascriptInterface
		public String getFile(String path, String encoding)
		{
			BufferedReader d = null;


			try
			{

				d = new BufferedReader(new InputStreamReader(FileUtils.openInputStream(new File(path)), encoding));
				StringBuffer b = new StringBuffer();
				String c =null;

				while ((c = d.readLine()) != null)
				{
					b.append(c + '\n');
				}
				if (b.length() > 0)
					b.deleteCharAt(b.length() - 1);
				c = b.toString();
				d.close();
				return c;
			}
			catch (FileNotFoundException e)
			{
				throw new RuntimeException(e);
			}
			catch (MalformedInputException e)
			{
				throw new RuntimeException(e);
			}
			catch (IOException e)
			{
				throw new RuntimeException(e);
			}
			finally
			{
				try
				{
					if (d != null)
						d.close();
				}
				catch (IOException e)
				{}

			}
		}
		@JavascriptInterface
		public boolean rename(String path, String dest)
		{
			try
			{
				new File(path).renameTo(new File(dest));
			}
			catch (Exception e)
			{
				return false;
			}
			return true;
		}
		@JavascriptInterface
		public boolean delete(String path)
		{
			try
			{
				return FileUtils.deleteQuietly(new File(path));
			}
			catch (Exception e)
			{
				return false;
			}
		}
		@JavascriptInterface
		public void runFile(String path)
		{
			Intent i = new Intent();
			i.setClass(web.getContext(), RunActivity.class);
			i.putExtra("path", path);
			web.getContext().startActivity(i);
		}
		@JavascriptInterface
		public boolean copyFile(String path, String dest, boolean overwrite)
		{
			File pack = new File(dest);
			if (!overwrite && pack.exists())return false;
			try
			{
				FileUtils.copyFile(new File(path), pack);
				return true;
			}
			catch (IOException e)
			{
				return false;
			}
		}
		@JavascriptInterface
		public boolean moveFile(String path, String dest, boolean overwrite)
		{
			File pack = new File(dest);
			if (!overwrite && pack.exists())return false;
			try
			{
				FileUtils.moveFile(new File(path), pack);
				return true;
			}
			catch (IOException e)
			{
				return false;
			}
		}
		@JavascriptInterface
		public String stat(String path)
		{
			StringWriter stringWriter = new StringWriter();
			JsonWriter bw = new JsonWriter(stringWriter);
			File p = new File(path);
			String value = null;
			try
			{
				bw.beginObject();
				bw.name("mtime").value(p.lastModified());
				bw.name("isDirectory").value(p.isDirectory());
				bw.name("isSymbolic").value(FileUtils.isSymlink(p));
				if (p.isFile())
					bw.name("size").value(FileUtils.sizeOf(p));
				else if (p.isDirectory())
				{
					bw.name("size").value(FileUtils.sizeOfDirectory(p));
				}
				bw.name("exists").value(p.exists());
				bw.name("isFile").value(p.isFile());
				bw.endObject();
				value = stringWriter.getBuffer().toString();
			}
			catch (IOException e)
			{
				Log.e("error", "error", e);
			}
			return value;
		};

		@JavascriptInterface
		public boolean saveFile(String path, String content)
		{
			return saveFile(path, content, "utf-8");
		}
		@JavascriptInterface
		public boolean saveFile(String path, String content, String encoding)
		{
			//File b = new File(path);
			Writer b=null;
			try
			{
				b =
					new BufferedWriter(new OutputStreamWriter(FileUtils.openOutputStream(new File(path)), encoding));

				b.write(content);

				return true;
			}

			catch (FileNotFoundException e)
			{
				return false;
			}

			catch (IOException e)
			{
				return false;
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
		}
		@JavascriptInterface
		public String getFiles(String path)
		{
			if (path == null)return null;
			File b = new File(path);

			File [] g = b.listFiles();
			if (g == null)
			{
				return null;
			}
			StringWriter a= new StringWriter();
			JsonWriter d = new JsonWriter(a);
			try
			{
				d.beginArray();
				for (File h:g)
				{

					d.value(h.getName() + (h.isDirectory() ?"/": ""));
				}
				d.endArray();
				a.flush();
				return a.getBuffer().toString();
			}
			catch (IOException e)
			{
				return null;
			}
			finally
			{
				try
				{
					if (a != null)
						a.close();
				}
				catch (IOException e)
				{}
			}
		}
	}

	@Override
	protected void onResume()
	{
		// TODO: Implement this method
		super.onResume();
		//web.requestFocusFromTouch();

		getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
	}
	@Override
	public void onBackPressed()
	{
		// TODO: Implement this method
		double backpressed = System.currentTimeMillis();
		if (backpressed - lastBackPressed < 750)
		{
			finish();
		}
		else
		{
			Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
		}
		lastBackPressed = backpressed;
	}
	public static class AppStorage extends SQLiteOpenHelper
	{
		private SQLiteDatabase db;

		private static final String TABLE_NAME="appStorage";
		private static final String APP_STORAGE_PATH = "appStorage";
		private static final int APP_STORAGE_VERSION = 1;

		private static MainActivity.AppStorage instance;
		private void createDb()
		{
			if (db == null)
			{
				db = this.getWritableDatabase();
			}
		}
		public void close()
		{
			if (db != null)
			{
				db.close();
				db = null;
			}
		}
		private static final String DB_CREATE = "CREATE TABLE " +
		TABLE_NAME + " (_id INTEGER PRIMARY KEY," +
		" key TEXT UNIQUE NOT NULL, value TEXT);";

		@Override
		public void onCreate(SQLiteDatabase p1)
		{
			try
			{
				p1.execSQL(DB_CREATE);
			}
			catch (SQLException e)
			{
				e.printStackTrace();
			}
		}

		@Override
		public void onUpgrade(SQLiteDatabase db, int oldVersion, 
							  int newVersion)
		{
			db.execSQL("DROP TABLE IF EXISTS " + TABLE_NAME);
			onCreate(db);
		}

		private AppStorage(Context ctx, String dbName, int dbVersion)
		{
			super(ctx, dbName, null, dbVersion);
		}
		public static AppStorage getInstance(Context ctx)
		{
			if (instance == null)
			{
				instance = new AppStorage(ctx, APP_STORAGE_PATH, APP_STORAGE_VERSION);
			}
			else
			{
				Log.w("AppStorage", "init called more than once");
			}
			instance.createDb();
			return instance;
		}
		@JavascriptInterface
		public void setItem(String x, String b)
		{

			ContentValues c = new ContentValues();
			c.put("key", x);
			c.put("value", b);
			db.replace(TABLE_NAME, null, c);
		}
		@JavascriptInterface
		public String getItem(String key)
		{
			Cursor c = null;
			String value = null;
			try
			{
				c = db.query(true, TABLE_NAME, new String[]{"value"},
							 "key = ?", new String[]{key}, null, null, null,
							 null);

				if (c.getCount() > 0)
				{
					c.moveToFirst();
					value = c.getString(0);
				}
			}
			catch (SQLException e)
			{
				Log.e("exception", "", e);
			}
			finally
			{
				if (c != null && !c.isClosed())
				{
					c.close();
				}
			}
			return value;
		}
		@JavascriptInterface
		public String getItems()
		{
			Cursor c = null;
			StringWriter a= new StringWriter();
			JsonWriter d = new JsonWriter(a);
			String value=null;
			try
			{
				c = db.query(true, TABLE_NAME, new String[]{"key"},
							 null, null, null, null, null,
							 null);
				d.beginArray();
				c.moveToFirst();
				for (int i=0;i < c.getCount();i++)
				{
					d.value(c.getString(0));
					c.moveToNext();
				}
				d.endArray();
				a.flush();
				value = a.getBuffer().toString();
				Log.e("result", value);
			}
			catch (SQLException e)
			{
				Log.e("exception", "", e);
			}
			catch (IOException e)
			{
				Log.e("exception", "", e);
			}
			finally
			{
				if (c != null && !c.isClosed())
				{
					c.close();
				}
			}
			return value;

		}
		@JavascriptInterface
		public void removeItem(String x)
		{
			db.delete(TABLE_NAME, "key = ?", new String[]{x});
		}
	}
	public static class C extends WebChromeClient
	{
		public static final int FILE_CHOOSER = 56;
		public ValueCallback<Uri> valueCallback;

		public boolean onShowFileChooser(WebView v, ValueCallback<Uri> u, WebChromeClient.FileChooserParams f)
		{
			Intent i = new Intent();
			((Activity)v.getContext()).startActivityForResult(f.createIntent(), this.FILE_CHOOSER);
			valueCallback = u;
			return true;
		}
		private Context ctx;
		public C(Context ctx)
		{
			this.ctx = ctx;
		}




		@Override
		public boolean onJsPrompt(WebView view, String url, String message, final String defaultValue, final JsPromptResult result)
		{
			// TODO: Implement this method
			//return super.onJsPrompt(view, url, message, defaultValue, result);
			AlertDialog.Builder b = new AlertDialog.Builder(ctx);
			final TextView textView = new EditText(ctx);
			textView.setMinLines(5);
			b.setView(textView);
			b.setTitle(message);
			b.setPositiveButton("Ok", new DialogInterface.OnClickListener(){

					@Override
					public void onClick(DialogInterface p1, int p2)
					{
						result.confirm(textView.getText().toString());
					}


				});
			b.setNegativeButton("Cancel", new DialogInterface.OnClickListener(){

					@Override
					public void onClick(DialogInterface p1, int p2)
					{
						result.confirm(defaultValue);
					}
				});
			b.setOnDismissListener(new DialogInterface.OnDismissListener(){

					@Override
					public void onDismiss(DialogInterface p1)
					{
						result.confirm(defaultValue);
					}


				});
			b.show();
			return true;
		}

		@Override
		public boolean onJsAlert(WebView view, String url, String message, final JsResult result)
		{
			// TODO: Implement this method
			AlertDialog.Builder b = new AlertDialog.Builder(ctx);
			TextView title = new TextView(ctx);
			b.setCustomTitle(title);
			title.setText(message);
			title.setPadding(15, 15, 15, 40);
			title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
			title.setTextColor(Color.WHITE);
			b.setPositiveButton("Ok", new DialogInterface.OnClickListener(){

					@Override
					public void onClick(DialogInterface p1, int p2)
					{
						result.confirm();
					}


				});
			b.setOnDismissListener(new DialogInterface.OnDismissListener(){

					@Override
					public void onDismiss(DialogInterface p1)
					{
						result.cancel();
					}


				});
			b.show();
			return true;
		}

		@Override
		public boolean onJsConfirm(WebView view, String url, String message, final JsResult result)
		{

			// TODO: Implement this method
			//return super.onJsPrompt(view, url, message, defaultValue, result);
			AlertDialog.Builder b = new AlertDialog.Builder(ctx);
			TextView title = new TextView(ctx);
			b.setCustomTitle(title);
			title.setText(message);
			title.setPadding(15, 15, 15, 40);
			title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
			title.setTextColor(Color.WHITE);
			b.setPositiveButton("Ok", new DialogInterface.OnClickListener(){

					@Override
					public void onClick(DialogInterface p1, int p2)
					{
						result.confirm();
					}


				});
			b.setNegativeButton("Cancel", new DialogInterface.OnClickListener(){

					@Override
					public void onClick(DialogInterface p1, int p2)
					{
						result.cancel();
					}
				});
			b.setOnDismissListener(new DialogInterface.OnDismissListener(){

					@Override
					public void onDismiss(DialogInterface p1)
					{
						result.cancel();
					}


				});
			b.show();
			return true;
		}


	}


}
