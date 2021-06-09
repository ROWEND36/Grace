package com.tmstudios.grace_editor;
import java.io.*;
import java.util.Date;
import android.util.*;
public class Logg
{
	public static File output;
	public static PrintStream p;
	public static void open(){
		if(true)return;
		File output = new File("/sdcard/grace_logs.txt");
		try
		{
			p = new PrintStream(new FileOutputStream(output,true));
			p.print("\n"+new Date().toString()+"\n");
		}
		catch (FileNotFoundException e)
		{}
	}
	public static PrintStream getP(){
		if(true)return System.out;
		if(p==null){
			Logg.open();
		}
		return p;
	}
	public static void e(String tag,String val){
		if(true)return;
		if(output==null){
			Logg.open();
		}
		if(p!=null){
//			Log.e(tag,val);
			p.print(tag+":"+val+"\n");
			p.flush();
		}
	}
	public static void close(){
		if(true)return;
		if(output != null)
			output = null;
		if(p!=null){
			p.close();
			p = null;
		}
	}
}
