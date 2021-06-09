package com.tmstudios.grace_editor;

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
import com.tmstudios.grace_editor.MainActivity.*;
import android.database.sqlite.*;
import android.net.*;
import android.annotation.*;
import java.nio.charset.*;
import org.apache.commons.io.FileUtils;
import android.*;
import android.content.pm.*;
import com.tmstudios.grace_editor.vfs.*;
public class MainActivity extends DebugActivity implements RenderProcessClient.MultiActivity
{
	public WebView web;
	public VirtualFileSystem fs;
	private ChromeClient chromeClient;
    //private final String root = "file:////sdcard/AppProjects/Flick/app/src/main/assets/index.html";
	private final String root = "file:///android_asset/index.html";
	private DelayedStorage localStorage;

	private static final int PERMISSION_REQUEST = 800;
	private RenderProcessClient viewClient;
	private boolean clearCache;
	@Override
    protected void onCreate(Bundle savedInstanceState)
    {
        super.onCreate(savedInstanceState);
		//HOME = this.getDataDir().getAbsolutePath() + "/public/";
		chromeClient = new ChromeClient(this);
		viewClient = new RenderProcessClient(this);
		localStorage = new DelayedStorage(this, 10);

		SharedPreferences p = getPreferences(MODE_PRIVATE);
		String version = getResources().getString(R.string.version_name);
		clearCache = p.getString("version","")!=version;
		if(clearCache){
			p.edit().putString("version",version).commit();
		}
		recreateWebview();
		Intent i = getIntent();
		if (i != null && i.getData() != null && ((i.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) == 0))
		{
			fs.notifyIntent(i);
		}
		
		/*
		AsyncTask<Void,Void,Void> extract = new AsyncTask<Void,Void,Void>(){

			@Override
			protected Void doInBackground(Void[] p1)
			{
				try
				{
					String[] files = getAssets().list("/");
					for (String file:files)
					{
						InputStream a = getAssets().open(file);
						FileUtils.copyInputStreamToFile(a, new File(HOME + file));
					}
				}
				catch (IOException e)
				{

				}
				return null;
			}

		};*/
	}
	/*public boolean checkVersion()
	{
		Resources b = getResources();
		String version = b.getString(R.string.versionName);
		String currentVersion = getSharedPreferences("version", MODE_PRIVATE).getString("version", "");
		if (currentVersion != version)
		{
			FileUtils.deleteQuietly(new File(HOME));
			return false;
		}
		return true;
	}
*/
	public void scheduleStop()
	{
		localStorage.doSync();
		//todo stop a webview completely
	}
	public void cancelStop()
	{
		//todo 
	}
	public void recreateWebview()
	{
		if (fs != null)fs.destroy();
		web = new WebView(this);
		web.setBackgroundColor(getResources().getColor(R.color.primaryDark));
        setContentView(web);
		web.setWebChromeClient(chromeClient);
		web.setWebViewClient(viewClient);
		WebSettings b =web.getSettings();
		b.setAllowFileAccess(true);
		b.setAllowContentAccess(true);
		b.setAllowFileAccessFromFileURLs(true);
		b.setJavaScriptEnabled(true);
		b.setBlockNetworkLoads(false);
		b.setDomStorageEnabled(true);
		b.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
		if(clearCache){
			web.clearCache(true);
			clearCache = false;
		}
		b.setAllowUniversalAccessFromFileURLs(true);
		fs = new FileStorage(web, root);
		web.addJavascriptInterface(localStorage, "appStorage");
		if (requestPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE))
		{
			fs.reload();
		}
	}
	protected boolean requestPermission(String permission)
	{
		if (Build.VERSION.SDK_INT >= 23)
		{
			if (this.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED)
			{
				this.requestPermissions(new String[]{permission}, PERMISSION_REQUEST);
				return false;
			}
		}
		return true;
	}

	@Override
	public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults)
	{
		super.onRequestPermissionsResult(requestCode, permissions, grantResults);
		if (permissions.length < 1)
		{
			return;
		}
		switch (requestCode)
		{
			case PERMISSION_REQUEST:
				Logg.close();
				Logg.open();
				fs.reload();
		}
	}

	@Override
	protected void onNewIntent(Intent intent)
	{
		String action = intent.getAction();
		String type = intent.getType();
		if (intent.getData() != null)
		{
			fs.notifyIntent(intent);
		}
		if (Intent.ACTION_SEND.equals(action) && type != null && type.startsWith("text/"))
		{
			fs.notifyIntent(intent); // Handle text being sent
		}
	}

	@Override
	protected void onPause()
	{
		localStorage.doSync();
		chromeClient.pause();
		fs.pause();
		localStorage.setDelay(0);
		web.onPause();
		if (Logg.p != null)
		{
			Logg.p.flush();
		}
		isVisible = false;
		super.onPause();
	}

	@Override
	protected void onDestroy()
	{
		AppStorage.getInstance(getApplicationContext()).close();
		web.loadUrl("about:none");
		fs.destroy();
		Logg.close();
		super.onDestroy();
	}

	@Override
	protected void onResume()
	{
		super.onResume();
		localStorage.setDelay(10);
		web.onResume();
		chromeClient.resume();
		fs.resume();
		resumedTime = System.currentTimeMillis();
		isVisible = true;
		getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
	}

	private double resumedTime;
	private double lastBackPressed;
	@Override
	public void onBackPressed()
	{
		double backpressed = System.currentTimeMillis();
		if (backpressed - resumedTime < 2000)
		{
			resumedTime -= 1000;
			return;
		}
		if (!web.canGoBack())
		{
			if (backpressed - lastBackPressed < 700)
				super.onBackPressed();
			else Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
			lastBackPressed = backpressed;
		}
		else
		{
			web.goBack();
		}
	}


}
