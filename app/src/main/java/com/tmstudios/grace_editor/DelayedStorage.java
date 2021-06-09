package com.tmstudios.grace_editor;
import android.content.*;
import java.util.*;
import android.webkit.*;
import android.os.*;
public class DelayedStorage
{
	AppStorage backend;
	Handler handler;
	private int delay;
	final HashMap<String,String> __queue;

	//unused private static final int MAX_QUEUE_LENGTH = 10;

	public DelayedStorage(Context ctx, int delayMinutes)
	{
		if (Build.VERSION.SDK_INT >= 28)
			handler = Handler.createAsync(Looper.getMainLooper());
		else 
			handler = new Handler(Looper.getMainLooper());
		backend = AppStorage.getInstance(ctx);
		delay = Math.min(10000, delayMinutes * 60000);
		__queue = new HashMap<String,String>();
	}
	@JavascriptInterface
    public synchronized void setItem(String key, String value)
	{
		if(value != null && value.length()>backend.MAX_VALUE_LENGTH){
			throw new RuntimeException("Error: MAX_VALUE_EXCEEDED");
		}
        __queue.put(key, value);
		schedule();
	}
	public void setDelay(int delayMinutes)
	{
		delay = delayMinutes * 60000;
		if (posted)
		{
			handler.removeCallbacks(syncTimeout);
			posted = false;
			schedule();
		}
	}
	@JavascriptInterface
    public String getItem(String key)
	{
        if (__queue.containsKey(key))
		{
			return __queue.get(key);
		}   
		else
		{
            return backend.getItem(key);
		}
	}
	@JavascriptInterface
    public void removeItem(String key)
	{
		this.setItem(key, null);
	}
	@JavascriptInterface
	public String getKeys()
	{
		return backend.getKeys();
	}
	@JavascriptInterface
	public String key(int n)
	{
		return backend.key(n);
	}
	@JavascriptInterface
    public synchronized void clear()
	{
		__queue.clear();
		backend.clear();
	}
    Runnable syncTimeout;
	boolean posted;
    private void schedule()
	{
		if (syncTimeout == null)
		{
			syncTimeout = new Runnable(){
				@Override
				public void run()
				{
					posted = false;
					DelayedStorage.this.doSync();
				}
			};
		}
		if (!posted)
		{
			posted = handler.postDelayed(syncTimeout, delay);
		}
	}

	public synchronized void doSync()
	{
		//doSync is only run on handlerThread
		//TODO remove synchronized
		if (posted)
		{
			handler.removeCallbacks(syncTimeout);
			posted = false;
		}
		for (HashMap.Entry<String,String> entry:__queue.entrySet())
		{
			try
			{
				if (entry.getValue() == null)
				{
					backend.removeItem(entry.getKey());
				}
				else backend.setItem(entry.getKey(), entry.getValue());
			}
			catch (Exception e)
			{
//				e.printStackTrace(Logg.getP());
			}
		}
		__queue.clear();
	}

}
