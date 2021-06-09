package com.tmstudios.grace_editor;
import android.webkit.*;
import android.net.*;
import android.content.*;
import android.app.*;
import android.widget.*;
import android.util.*;
import android.graphics.*;
import java.util.*;
import android.annotation.*;
import android.os.*;
import android.view.*;

public class ChromeClient extends WebChromeClient
{
	public static final int FILE_CHOOSER = 56;
	public ValueCallback valueCallback;

	public synchronized boolean onShowFileChooser(WebView v, ValueCallback u, WebChromeClient.FileChooserParams f)
	{
		((Activity)v.getContext()).startActivityForResult(f.createIntent(), this.FILE_CHOOSER);
		valueCallback = u;
		return true;
	}
	private Context ctx;
	public ChromeClient(Context ctx)
	{
		this.ctx = ctx;
	}
    private boolean paused;
    public synchronized void pause()
	{
        paused = true;
    }
    public synchronized void resume()
	{
        paused = false;
    }

	
	@Override
	public synchronized void onPermissionRequest(PermissionRequest request)
	{
//		Logg.e("permission request", request.getOrigin().getScheme());
		if (request.getOrigin().getScheme() == "file")
		{
			request.grant(request.getResources());
		}
		else
		{
			super.onPermissionRequest(request);
		}
	}
	
	@Override
	public synchronized boolean onJsPrompt(WebView view, String url, String message, final String defaultValue, final JsPromptResult result)
	{

		if (paused)
			return false;

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
	public View createView(Context ctx, String message)
	{
		FrameLayout f = new FrameLayout(ctx);
		View v;
		TextView t = new TextView(ctx);
		t.setText(message);

		t.setPadding(15, 15, 15, 40);
		t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
		t.setTextColor(Color.WHITE);
		int size = FrameLayout.LayoutParams.MATCH_PARENT;

		if (message.length() > 100)
		{
			size = (int)Math.floor(ctx.getResources().getDimension(R.dimen.dp_200));
			ScrollView s = new ScrollView(ctx);
			s.addView(t);
			v = s;
		}
		else
		{
			v = t;
		}
		f.addView(v, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.FILL_PARENT, size));
		return f;
	}
	@Override
	public synchronized boolean onJsAlert(WebView view, String url, String message, final JsResult result)
	{
		if (paused)
			return false;

		AlertDialog.Builder b = new AlertDialog.Builder(ctx);
		b.setView(createView(ctx, message));
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
	public synchronized boolean onJsConfirm(WebView view, String url, String message, final JsResult result)
	{

		if (paused)
			return false;

		AlertDialog.Builder b = new AlertDialog.Builder(ctx);
		b.setView(createView(ctx, message));
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
