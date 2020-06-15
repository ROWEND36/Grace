package com.tmstudios.shunt;
import android.webkit.*;
import android.view.*;
import android.os.*;
import android.app.*;
import android.view.ViewGroup.*;
import android.widget.*;
import android.util.*;
import android.content.*;
import com.tmstudios.shunt.MainActivity.*;
import android.graphics.*;
import android.net.*;
import java.util.*;
import java.util.function.*;
public class RunActivity extends Activity
{
	WebView web;
	View console;
	private ConsoleAdapter adapter;
	public View consoleToggle;
	public int maxOrdinal;
	public List<ConsoleMessage> messageList;
	private MainActivity.C chromeClient;

	private int mode = -1;

	private View selected;
	protected void onCreate(Bundle savedInstanceState)
	{
		super.onCreate(savedInstanceState);
		setContentView(R.layout.console);
		web = findViewById(R.id.webview);
		messageList = new ArrayList<ConsoleMessage>();
		web.setWebViewClient(new MainActivity.B());
		this.selected = findViewById(R.id.filterAll);
		console = findViewById(R.id.console);
		consoleToggle = findViewById(R.id.consoleToggle);
		consoleToggle.setOnTouchListener(new View.OnTouchListener(){

				private float lastX;

				private float lastY;

				@Override
				public boolean onTouch(View p1, MotionEvent p)
				{
					switch (p.getAction())
					{
						case MotionEvent.ACTION_DOWN:
							lastX = p.getX();
							lastY = p.getY();
							break;
						case MotionEvent.ACTION_MOVE:
							if (Math.abs(p.getX() - lastX) + Math.abs(p.getY() - lastY) > 100)
							{

								return p1.startDrag(null, new View.DragShadowBuilder(), null, 0);
							}
					}
					//probably fade away to be enabled disabled by long click
					return false;
				}


			});
		web.setOnDragListener(new View.OnDragListener(){

				@Override
				public boolean onDrag(View p1, DragEvent p2)
				{
					// TODO: Implement this method

					if (p2.getAction() == DragEvent.ACTION_DRAG_LOCATION)
					{
						((MarginLayoutParams)consoleToggle.getLayoutParams()).leftMargin = (int) p2.getX();
						((MarginLayoutParams)consoleToggle.getLayoutParams()).topMargin = (int) p2.getY();
						consoleToggle.requestLayout();
					}
					else if (p2.getAction() == DragEvent.ACTION_DRAG_ENDED)
					{
						ViewGroup.MarginLayoutParams params = ((MarginLayoutParams)consoleToggle.getLayoutParams());
						AppStorage.getInstance(getApplicationContext()).setItem("leftMargin" , "" + params.leftMargin);
						AppStorage.getInstance(getApplicationContext()).setItem("topMargin", "" + params.topMargin);

					}
					return true;

				}
			});

		ListView messages = findViewById(R.id.messages);
		adapter = new ConsoleAdapter(this, 0);
		messages.setAdapter(adapter);

		WebSettings b =web.getSettings();
		b.setAllowFileAccess(true);
		b.setAllowFileAccessFromFileURLs(true);
		b.setJavaScriptEnabled(true);
		b.setAllowUniversalAccessFromFileURLs(true);
		b.setDomStorageEnabled(true);
		b.setBlockNetworkLoads(false);
		adapter.add(new ConsoleMessage("...console started", getIntent().getExtras().getString("path"), 0, ConsoleMessage.MessageLevel.LOG));

		chromeClient = new C(this){

			public boolean onConsoleMessage(ConsoleMessage m)
			{
				
				messageList.add(m);
				if (mode < 0 || m.messageLevel().ordinal() == mode)
				{
					adapter.add(m);
				}
				View color_bar = consoleToggle;
				
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

				return true;
			}
		};
		web.setWebChromeClient(chromeClient);
		web.loadUrl(getIntent().getExtras().getString("path"));

	}
	private double last;

	@Override
	protected void onActivityResult(int requestCode, int resultCode, Intent data)
	{
		// TODO: Implement this method
		super.onActivityResult(requestCode, resultCode, data);
		if (resultCode == RESULT_OK)
		{
			switch (requestCode)
			{
				case C.FILE_CHOOSER:
					chromeClient.valueCallback.onReceiveValue(data.getData());
			}
		}

	}

	public void toggleConsole(View v)
	{
		if (console.isShown())
		{
			console.setVisibility(View.INVISIBLE);
			consoleToggle.setBackgroundResource(R.drawable.circle_okay);
			maxOrdinal = 0;
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
		if (mode == this.mode)
		{
			return;
		}
		this.mode = mode;
		this.selected.setSelected(false);
		this.selected = v;
		v.setSelected(true);
		ArrayList<ConsoleMessage> filtered = new ArrayList<ConsoleMessage>(messageList);
		if (mode > -1)
			filtered.removeIf(new Predicate<ConsoleMessage>(){

					@Override
					public boolean test(ConsoleMessage p1)
					{
						// TODO: Implement this method
						if (p1.messageLevel().ordinal() == RunActivity.this.mode)
							return false;
						return true;
					}
				});
		adapter.clear();
		adapter.addAll(filtered);
	}

	public void clearCache(View v)
	{
		web.clearCache(true);
	}
	public void reloadWebview(View v)
	{
		web.pauseTimers();
		web.reload();
		web.resumeTimers();
	}
	public void goForward(View v)
	{
		web.goForward();
		if (!web.canGoForward())
		{
			v.setEnabled(false);
		}
	}
	public void goBackward(View v)
	{
		web.goBack();
		if (!web.canGoBack())
		{
			v.setEnabled(false);
		}
	}
	public void crashReload(View v)
	{
		Toast.makeText(this, "Force Stopped", Toast.LENGTH_SHORT).show();
		throw new RuntimeException("Crash reload");
	}
	@Override
	protected void onResume()
	{
		// TODO: Implement this method
		super.onResume();
		String  sl = AppStorage.getInstance(getApplicationContext()).getItem("leftMargin");
		String st = AppStorage.getInstance(getApplicationContext()).getItem("topMargin");
		int l = 0, t =0;
		if (sl != null)l = new Integer(sl);
		if (st != null)t = new Integer(st);
		ViewGroup.MarginLayoutParams a = ((MarginLayoutParams)consoleToggle.getLayoutParams());
		a.setMargins(l, t, 0, 0);
		consoleToggle.requestLayout();
	}

	@Override
	public void onBackPressed()
	{
		// TODO: Implement this method
		double backpressed = System.currentTimeMillis();
		if (console.isShown())
		{
			console.setVisibility(View.INVISIBLE);
			backpressed = 0;
		}
		else if (backpressed - last < 750)
		{
			super.onBackPressed();
		}
		else
		{
			if (web.canGoBack())
				web.goBack();
			else
			{
				super.onBackPressed();
			}
		}
		last = backpressed;
	}
	public void clearLogs(View v){
		messageList.clear();
		adapter.clear();
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
			}
			((TextView)convertView.findViewById(R.id.message)).setText(b.message());
			((TextView)convertView.findViewById(R.id.position)).setText(String.format("Line: %d File: %s", b.lineNumber(), b.sourceId()));
			return convertView;
		}

	}
}
