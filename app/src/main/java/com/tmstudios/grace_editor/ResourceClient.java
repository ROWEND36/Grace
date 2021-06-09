package com.tmstudios.grace_editor;
import android.webkit.*;
import android.graphics.*;
import android.os.*;
import android.widget.*;

public class ResourceClient extends RenderProcessClient
{
	RunActivity client;
	public ResourceClient(RunActivity ctx){
		super(ctx);
		client = ctx;
	}
	
	@Override
	public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request)
	{
		client.logUrl(request.getUrl().toString());
		return super.shouldOverrideUrlLoading(view, request);
	}
	
	@Override
	public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request)
	{
		client.logUrl(request.getUrl().toString());
		return super.shouldInterceptRequest(view, request);
	}

	@Override
	public void onPageStarted(WebView view, String url, Bitmap favicon)
	{
		// TODO: Implement this method
		client.logUrl(url);
		super.onPageStarted(view, url, favicon);
	}

	@Override
	public void onPageFinished(WebView view, String url)
	{
		// TODO: Implement this method
		client.logUrl(url+" Loaded");
		super.onPageFinished(view, url);
	}

	@Override
	public void onLoadResource(WebView view, String url)
	{
		// TODO: Implement this method
		client.logUrl(url+" Loaded");
		super.onLoadResource(view, url);
	}

	@Override
	public void onFormResubmission(WebView view, Message dontResend, Message resend)
	{
		Toast.makeText(client,"Resubmitting form",Toast.LENGTH_SHORT).show();
		super.onFormResubmission(view, dontResend, resend);
	}
	
	@Override
	public void onReceivedError(WebView view, int errorCode, String description, String failingUrl)
	{
		client.errorUrl(failingUrl,description);
		super.onReceivedError(view, errorCode, description, failingUrl);
	}
	
}
