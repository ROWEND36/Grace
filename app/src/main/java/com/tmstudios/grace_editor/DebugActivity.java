package com.tmstudios.grace_editor;
import android.app.*;
import android.os.*;
import android.content.*;
import java.io.*;

public class DebugActivity extends Activity 
{

	protected boolean stack=false;

	@Override
	protected void onCreate(Bundle savedInstanceState)
	{
		// TODO: Implement this method
		super.onCreate(savedInstanceState);
		if (getIntent() != null)
		{
			if (getIntent().getExtras() != null)
			{

				if (getIntent().getExtras().getString("stack_trace") != null)
				{
					stack = true;
					AlertDialog b = new AlertDialog.Builder(this).setTitle("Crash").setMessage(
						getIntent().getExtras().getString("stack_trace")).create();
					b.show();
				}
			}
		}

		Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler()
			{
				@Override
				public void uncaughtException(Thread thread, Throwable e)
				{
					handleUncaughtException(thread, e);
				}
			});

	}
	public void handleUncaughtException(Thread thread, Throwable e)
	{
		final Intent intent = new Intent(this, DebugActivity.class);
		StringWriter sw = new StringWriter();
		PrintWriter pw = new PrintWriter(sw);
		e.printStackTrace(pw);
		String stackTraceString = sw.toString();

		//Reduce data to 128KB so we don't get a TransactionTooLargeException when sending the intent.
		//The limit is 1MB on Android but some devices seem to have it lower.
		//See: http://developer.android.com/reference/android/os/TransactionTooLargeException.html
		//And: http://stackoverflow.com/questions/11451393/what-to-do-on-transactiontoolargeexception#comment46697371_12809171
		if (stackTraceString.length() > 128000)
		{
			String disclaimer = " [stack trace too large]";
			stackTraceString = stackTraceString.substring(0, 128000 - disclaimer.length()) + disclaimer;
		}
		intent.putExtra("stack_trace", stackTraceString);
		intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK);
		intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
		if (!stack)
			startActivity(intent);
		finish();
		System.exit(0);
	}
}
