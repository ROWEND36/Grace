package com.tmstudios.grace_editor.vcs;
import org.eclipse.jgit.ignore.internal.*;

public interface VCSInterface
{
	/*set the root directory and working directory*/
	public void setDir(String dir, String gitdir);
	
	/*not sure what this will do*/
	public void cached();
	
	/*walk the rootdir changes needed to checkout*/
	public String analyze(String dir);
	
	/*pending*/
	public String completeMerge(String ourOid, String theirOid,String ours, String theirs,int author,int committer, String signingKey, String message);
	/*pending*/
	public String startMerge(String ourOid,String theirOid,String ours,String theirs,int author,int committer,String signingKey, String message);
	
	/*create a new repository*/
	public void init();
	
	/*clone a remote repository*/
	public void clone(String singleBranch, String url, String user,String pass, int onProgress);
	
	/*fetch remote refs*/
	public void fetch(String singleBranch, String url, String user,String pass, int onProgress);
	
	/*update working directory, head to match a given commit.*/
	public void checkout(String filepaths, String ref, boolean force, int onProgress);
	
	/*Commit staged files*/
	public void commit(String message, String author);
	
	/*Edit Git configiration file*/
	public void setConfig(String path, String value);
	public String getConfig(String path);
	
	public void addRemote(String ref,String url);
	public String listRemotes();
	
	/*return current branch*/
	public String currentBranch();
	
	/*convert master -> a49rjd94939393i39....*/
	public String resolveRef(String ref);
	public void writeRef(String ref,String oid);
	
	/*pending*/
	public void merge(String theirs,int author,String name,String email,boolean dryRun,boolean fastForwardOnly,int onProgress);
	
	/*return whether a file is modified, added, deleted etc*/
	public String status(String filepath);
	
	/*stage a file*/
	public void add(String filepath);
	
	/*unstage a file by removing it from index*/
	public void remove(String filepath);
	
	/*unstage a file by setting it to the last commit*/
	public void resetIndex(String filepath);
	
	/*list all files in ref or index if no ref*/
	public String listFiles(String ref);
	
	/*list all commits*/
	public String log();
	
	public void branch(String ref);
	public void deleteBranch(String ref);
	public String listBranches(String remote);
}
