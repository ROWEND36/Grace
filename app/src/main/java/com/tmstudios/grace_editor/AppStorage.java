package com.tmstudios.grace_editor;
import android.database.sqlite.*;
import android.database.*;
import android.content.*;
import android.util.*;
import android.webkit.*;
import java.io.*;

public class AppStorage extends SQLiteOpenHelper
{
	private SQLiteDatabase db;

	private static final String TABLE_NAME="appStorage";
	private static final String APP_STORAGE_PATH = "appStorage";
	private static final int APP_STORAGE_VERSION = 1;
	private static final int MAX_KEY_LENGTH = 512;
	//bigger values are handled in software
	public static final int MAX_VALUE_LENGTH = 1024*1024 -100/*<1mb*/;
	private static final int MAX_SIZE = 1024*1024*1024*50-1/*<50mb*/;
	private static AppStorage instance;
	private void createDb()
	{
		if (db == null)
		{
			db = this.getWritableDatabase();
			db.setMaximumSize(MAX_SIZE);
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
//			Log.w("AppStorage", "init called more than once");
		}
		instance.createDb();
		return instance;
	}
	@JavascriptInterface
	public void setItem(String x, String b)
	{
		if(x.length()>MAX_KEY_LENGTH || b.length()>MAX_VALUE_LENGTH){
			Logg.e("Error","Max Key Length/Max Value Length exceeded");
		}
		if (db == null)
		{
//			Logg.e("AppStorage", "setItem no db");
			this.createDb();
		}
		ContentValues c = new ContentValues();
		c.put("key", x);
		c.put("value", b);
		db.replace(TABLE_NAME, null, c);
	}
	@JavascriptInterface
	public String getItem(String key)
	{
		if (db == null)
		{
//			Logg.e("AppStorage", "setItem no db");
			this.createDb();
		}
		Cursor c = null;
		String value = "";
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
		catch (Exception e)
		{
//			e.printStackTrace(Logg.getP());
//			Log.e("exception", "", e);
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
	public String key(int n)
	{
		if (db == null)
		{
//			Logg.e("AppStorage", "key called no db");
			this.createDb();
		}
		Cursor c = null;
		StringWriter a= new StringWriter();
		JsonWriter d = new JsonWriter(a);
		String value=null;
		try
		{
			c = db.query(true, TABLE_NAME, new String[]{"key"},
						 null, null, null, null, null,
						 n + ",1");
			if (c.getCount() > 1)
			{
				return c.getString(0);
			}
		}
		catch (Exception e)
		{
//			e.printStackTrace(Logg.getP());
//			Log.e("exception", "", e);
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
	public String getKeys()
	{
		if (db == null)
		{
//			Logg.e("AppStorage", "get keys no db");
			this.createDb();
		}
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
//			Log.e("result", value);
		}
		catch (Exception e)
		{
//			e.printStackTrace(Logg.getP());
//			Log.e("exception", "", e);
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
	public void clear()
	{
		if (db == null)
		{
//			Logg.e("AppStorage", "clear no db");
			this.createDb();
		}
		db.delete(TABLE_NAME, null, null);
	}
	@JavascriptInterface
	public void removeItem(String x)
	{
		if (db == null)
		{
//			Logg.e("AppStorage", "removeItem no db");
			this.createDb();
		}
		db.delete(TABLE_NAME, "key = ?", new String[]{x});
	}
}
	

