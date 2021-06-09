package com.tmstudios.grace_editor;
import android.webkit.*;
import android.view.*;
import android.os.*;
import android.app.*;
import android.view.ViewGroup.*;
import android.widget.*;
import android.util.*;
import android.content.*;
import com.tmstudios.grace_editor.MainActivity.*;
import android.graphics.*;
import android.net.*;
import java.util.*;
import java.util.function.*;
import java.io.*;
import android.content.res.*;

public class RunActivity extends DebugActivity implements View.OnTouchListener, RenderProcessClient.MultiActivity,View.OnDragListener
{
	protected WebView web;
	View console;
	private ConsoleChromeClient chromeClient;
	private View consoleToggle;
	private int lastX;
	private int lastY;
	private View selected;
	private boolean inDrag = false;
    private RenderProcessClient viewClient;
	private Handler handler;
	protected void onCreate(Bundle savedInstanceState)
	{
	    super.onCreate(savedInstanceState);
		handler = new Handler();
		createWebview();
		
	}
	
	public boolean handleToggleTouch(MotionEvent p)
	{
		switch (p.getAction())
		{
			case MotionEvent.ACTION_DOWN:
				lastX = (int) p.getX();
				lastY = (int) p.getY();
				break;
			case MotionEvent.ACTION_MOVE:
				if (Math.abs(p.getX() - lastX) > 50 || Math.abs(p.getY() - lastY) > 50)
				{
					inDrag = true;
					web.setOnTouchListener(this);
					consoleToggle.startDrag(null, new View.DragShadowBuilder(consoleToggle), null, 0);
					consoleToggle.setVisibility(View.INVISIBLE);
				}
		}
		return false;
	}
	@Override
	public boolean onDrag(View p1, DragEvent p2)
	{
		if (inDrag)
		{
			if (p2.getAction() == DragEvent.ACTION_DRAG_LOCATION)
			{
				lastX = (int)p2.getX() - consoleToggle.getWidth() / 2;
				lastY = (int)p2.getY() - consoleToggle.getHeight() / 2;
			}
			else if (p2.getAction() == DragEvent.ACTION_DRAG_ENDED)
			{
				endDrag();
			}
			return true;
		}
		return false;
	}
	private void endDrag()
	{
		inDrag = false;
		ViewGroup.MarginLayoutParams params = ((MarginLayoutParams)consoleToggle.getLayoutParams());
		params.leftMargin =  lastX;
		params.topMargin =  lastY;
		consoleToggle.setVisibility(View.VISIBLE);
		consoleToggle.requestLayout();
		SharedPreferences.Editor a = getSharedPreferences("console",MODE_PRIVATE).edit();
		a.putInt("leftMargin" , lastX);
		a.putInt("topMargin", lastY);
		a.commit();
		web.setOnTouchListener(null);
	}

	@Override
	public void recreateWebview()
	{
		handler.post(new Runnable(){
			public void run(){
				RunActivity.this.createWebview();
			}
		});
	}

	public void createWebview()
	{
		setContentView(R.layout.console);
		ListView messages = findViewById(R.id.messages);
		consoleToggle = findViewById(R.id.consoleToggle);
		ConsoleAdapter adapter = new ConsoleAdapter(this, 0);
		messages.setAdapter(adapter);
		chromeClient = new ConsoleChromeClient(this, adapter, consoleToggle,handler);
		viewClient = new ResourceClient(this);
		this.selected = findViewById(R.id.filterAll);
		console = findViewById(R.id.console);

		FrameLayout root = findViewById(R.id.frameLayout);
		root.setOnDragListener(this);
		consoleToggle.setOnTouchListener(new View.OnTouchListener(){
				@Override
				public boolean onTouch(View p1, MotionEvent p)
				{
					return handleToggleTouch(p);
				}
			});
		web = new WebView(this);
		WebSettings b = web.getSettings();
		b.setAllowFileAccess(true);
		b.setAllowFileAccessFromFileURLs(true);
		b.setJavaScriptEnabled(true);
		b.setAllowUniversalAccessFromFileURLs(true);
		b.setDomStorageEnabled(true);
		b.setBlockNetworkLoads(false);
		web.setWebViewClient(viewClient);
		web.setWebChromeClient(chromeClient);
		root.addView(web, 0, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.FILL_PARENT, FrameLayout.LayoutParams.FILL_PARENT));
		web.clearCache(true);
		web.loadUrl(getIntent().getStringExtra("path"));
	}
	protected double last;

	@Override
	protected void onNewIntent(Intent intent)
	{
		if (intent.getExtras().getBoolean("finish"))
		{
			finish();
			return;
		}
		else web.loadUrl(intent.getStringExtra("path"));
		setIntent(intent);
	}


	@Override
	protected void onActivityResult(int requestCode, int resultCode, Intent data)
	{
		super.onActivityResult(requestCode, resultCode, data);

		if (resultCode == RESULT_OK)
		{

			switch (requestCode)
			{
				case ChromeClient.FILE_CHOOSER:
					if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP)
					{
						chromeClient.valueCallback.onReceiveValue(new Uri[]{Uri.parse(data.getDataString())});
					}
					else
					{
						chromeClient.valueCallback.onReceiveValue(Uri.parse(data.getDataString()));						
					}
					break;
				default:
					Toast.makeText(this, "Received value unknown request", Toast.LENGTH_LONG).show();


			}
		}
		else Toast.makeText(this, "Received code " + resultCode, Toast.LENGTH_LONG).show();

	}

	public void toggleConsole(View v)
	{
		if (console.isShown())
		{
			console.setVisibility(View.INVISIBLE);
			chromeClient.reset();
		}
		else
			console.setVisibility(View.VISIBLE);

	}
	public void switchConsole(View v)
	{
		int mode = -1;
		switch (v.getId())
		{
			case R.id.filterAll:
				mode = -1;
				break;
			case R.id.filterLog:
				mode = ConsoleMessage.MessageLevel.LOG.ordinal();
				break;
			case R.id.filterDebug:
				mode = ConsoleMessage.MessageLevel.DEBUG.ordinal();
				break;
			case R.id.filterInfo:
				mode = ConsoleMessage.MessageLevel.TIP.ordinal();
				break;
			case R.id.filterError:
				mode = ConsoleMessage.MessageLevel.ERROR.ordinal();
				break;
			case R.id.filterWarning:
				mode = ConsoleMessage.MessageLevel.WARNING.ordinal();
				break;
		}
		chromeClient.setMode(mode);
		if (this.selected != v)
		{
			this.selected.setSelected(false);
			this.selected = v;
			v.setSelected(true);
		}
	}
	public void logUrl(String message){
		chromeClient.onConsoleMessage(new ConsoleMessage(message,"Resources",0,ConsoleMessage.MessageLevel.TIP));
	}
	public void errorUrl(String message,String url){
		chromeClient.onConsoleMessage(new ConsoleMessage("Error: "+message,url,0,ConsoleMessage.MessageLevel.WARNING));
	}
	public void clearCache(View v)
	{
		web.clearCache(true);
	}
	public void reloadWebview(View v)
	{
		web.reload();
	}
	public void goForward(View v)
	{
		web.goForward();
		updateEnabled();
	}
	public void updateEnabled(){
		View back = findViewById(R.id.buttonBack);
		View forward = findViewById(R.id.buttonForward);
		forward.setEnabled(web.canGoForward());
		back.setEnabled(web.canGoBack());
	}
	public void goBackward(View v)
	{
		web.goBack();
		updateEnabled();
	}
	@Override
	protected void onResume()
	{
		super.onResume();
		chromeClient.resume();
		position();
		}
	
	public void position(){
		ViewGroup.MarginLayoutParams a = ((MarginLayoutParams)consoleToggle.getLayoutParams());
		SharedPreferences pos = getSharedPreferences("console",MODE_PRIVATE);
		int leftMargin = pos.getInt("leftMargin", 0);
		int topMargin = pos.getInt("topMargin", 0);
		int padding = (int)(80 *Resources.getSystem().getDisplayMetrics().density);
		int ml  = Resources.getSystem().getDisplayMetrics().widthPixels -padding;
		int mt = Resources.getSystem().getDisplayMetrics().heightPixels -padding;
		a.setMargins(Math.min(ml, leftMargin), Math.min(topMargin, mt), 0, 0);
		consoleToggle.requestLayout();
	}
	@Override
	public void onConfigurationChanged(Configuration newConfig)
	{
		super.onConfigurationChanged(newConfig);
		position();
	}
	
	@Override
	protected void onPause()
	{
		isVisible = false;
		chromeClient.pause();
		super.onPause();
	}
	
	@Override
	public void onBackPressed()
	{
		if (stack)
		{
			finish();
		}
		double backpressed = System.currentTimeMillis();
		if (console.isShown())
		{
			console.setVisibility(View.INVISIBLE);
			backpressed = 0;
		}
		else if (backpressed - last < 700)
		{
			finish();
		}
		else
		{
			if (web.canGoBack())
				web.goBack();
			else
			{
				finish();
			}
		}
		last = backpressed;
	}
	public void clearLogs(View v)
	{
		chromeClient.clear();
	}
	
	@Override
	public boolean onTouch(View p1, MotionEvent p2)
	{
		if (inDrag && (p2.getAction() == MotionEvent.ACTION_UP || p2.getAction() == MotionEvent.ACTION_CANCEL))
		{
			this.endDrag();
		}
		return true;
	}
	static class ConsoleChromeClient extends ChromeClient
	{
		private List<ConsoleMessage> messageList;
		private ConsoleAdapter adapter;
		private View color_bar;
		private int mode=-1;
		private Handler handler;
		public int maxOrdinal=0;
		public ConsoleChromeClient(Context ctx, ConsoleAdapter adapter, View indicator,Handler handler)
		{
			super(ctx);
			this.messageList = new ArrayList<ConsoleMessage>();
			this.adapter = adapter;
			this.handler = handler;
			this.color_bar = indicator;
		}
		public void reset()
		{
			color_bar.setBackgroundResource(R.drawable.circle_okay);
			maxOrdinal = 0;
		}

		@Override
		public void onReceivedTitle(WebView view, String title)
		{
			// TODO: Implement this method
			super.onReceivedTitle(view, title);
			this.onConsoleMessage(new ConsoleMessage("Title: "+title,view.getUrl(),0,ConsoleMessage.MessageLevel.TIP));
		}
		public void addMessage(ConsoleMessage m){
			messageList.add(m);
			if ((mode < 0 && m.messageLevel()!=ConsoleMessage.MessageLevel.TIP) || m.messageLevel().ordinal() == mode)
			{
				adapter.add(m);
			}

			if (m.messageLevel().ordinal() > maxOrdinal)
			{
				switch (m.messageLevel())
				{
					case LOG:
						color_bar.setBackgroundResource(R.drawable.circle_log);
						break;
					case WARNING:
						color_bar.setBackgroundResource(R.drawable.circle_warn);
						break;
					case ERROR:
						color_bar.setBackgroundResource(R.drawable.circle_error);
						break;
				}
				maxOrdinal = m.messageLevel().ordinal();
			}
			
		}
		@Override
		public boolean onConsoleMessage(final ConsoleMessage m)
		{
			handler.post(new Runnable(){
				public void run(){
					addMessage(m);
				}
			});
			return true;
		}
		public void setMode(int mode)
		{
			if (mode == this.mode)
			{
				return;
			}
			this.mode = mode;
			ArrayList<ConsoleMessage> filtered = new ArrayList<ConsoleMessage>(messageList);
			if (mode > -1)
				filtered.removeIf(new Predicate<ConsoleMessage>(){

						@Override
						public boolean test(ConsoleMessage p1)
						{
							// TODO: Implement this method
							if (p1.messageLevel().ordinal() == ConsoleChromeClient.this.mode)
								return false;
							return true;
						}
					});
			else
				filtered.removeIf(new Predicate<ConsoleMessage>(){

						@Override
						public boolean test(ConsoleMessage p1)
						{
							// TODO: Implement this method
							if (p1.messageLevel() == ConsoleMessage.MessageLevel.TIP)
								return true;
							return false;
						}
					});
			adapter.clear();
			adapter.addAll(filtered);
		}
		public void clear()
		{
			messageList.clear();
			adapter.clear();
		}
	}
	static class ConsoleAdapter extends ArrayAdapter<ConsoleMessage>
	{

		public ConsoleAdapter(Context ctx, int textViewId)
		{
			super(ctx, textViewId);
		}

		@Override
		public View getView(int position, View convertView, ViewGroup parent)
		{
			// TODO: Implement this method
			ConsoleMessage b = getItem(position);
			if (convertView == null)
				convertView = ((Activity)getContext()).getLayoutInflater().inflate(R.layout.message, parent, false);
			View color_bar = convertView.findViewById(R.id.color_bar);
			switch (b.messageLevel())
			{
				case TIP:
					color_bar.setBackgroundColor(Color.GREEN);
					break;
				case WARNING:
					color_bar.setBackgroundColor(Color.rgb(255, 128, 0));
					break;
				case ERROR:
					color_bar.setBackgroundColor(Color.RED);
					break;
				case DEBUG:
					color_bar.setBackgroundColor(Color.GRAY);
					break;
				default:
					color_bar.setBackgroundColor(Color.rgb(25, 90, 250));
			}
			((TextView)convertView.findViewById(R.id.message)).setText(b.message());
			((TextView)convertView.findViewById(R.id.position)).setText(String.format("Line: %d File: %s", b.lineNumber(), b.sourceId()));
			return convertView;
		}

	}
	public static class RunNewProcess extends RunActivity
	{
		public static boolean callInit=false;
		@Override
		public void onCreate(Bundle savedInstanceState)
		{
			if(Build.VERSION.SDK_INT>=28 && !callInit){
				callInit = true;
				WebView.setDataDirectorySuffix("-newprocess");
				}
			super.onCreate(savedInstanceState);
		}

		@Override
		public File getDir(String name, int mode)
		{
			return super.getDir(name+"-newprocess", mode);
		}

		@Override
		public File getCacheDir()
		{
			return getDir("cache",0);
		}
		
		/*@Override
		public void onBackPressed()
		{

			double backpressed = System.currentTimeMillis();
			if (console.isShown())
			{
				this.console.setVisibility(View.INVISIBLE);
				backpressed = 0;
			}
			else if (backpressed - last < 750)
			{
				startActivity(new Intent(getApplicationContext(), MainActivity.class));
			}
			else
			{
				if (this.web.canGoBack())
					this.web.goBack();
				else
				{
					startActivity(new Intent(getApplicationContext(), MainActivity.class));
				}
			}
			last = backpressed;
		}
*/
	}
}
