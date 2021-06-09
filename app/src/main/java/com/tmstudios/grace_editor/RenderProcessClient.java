package com.tmstudios.grace_editor;
import android.webkit.*;
import android.util.*;
import java.util.Date;
import android.view.*;

public class RenderProcessClient extends WebViewClient
{
	public interface MultiActivity{
		public void recreateWebview();
		public void finish();
		public boolean isVisible;
	}
	protected MultiActivity client;
	public RenderProcessClient(MultiActivity chrome){
		this.client = chrome;
	}

	@Override
	public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail)
	{
		if(detail.didCrash() && this.client.isVisible){
			this.client.recreateWebview();
		}
		else {
			this.client.finish();
		}
		return true;
	}
	
	
}
