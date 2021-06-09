package com.tmstudios.grace_editor.vcs;
import org.eclipse.jgit.lib.*;
import java.io.*;
import org.eclipse.jgit.api.*;
import org.eclipse.jgit.api.errors.*;
import org.eclipse.jgit.transport.URIish;
import java.net.*;
import android.webkit.*;
import java.util.*;
import org.json.*;
import org.eclipse.jgit.transport.*;
import org.eclipse.jgit.errors.*;
import com.tmstudios.grace_editor.vfs.*;
import org.eclipse.jgit.dircache.*;
import org.eclipse.jgit.revwalk.*;
import org.eclipse.jgit.treewalk.*;
import java.security.*;
import android.util.Log;

public class JGitVCS implements VCSInterface
{
	VirtualFileSystem vfs;
	public void setWebInterface(VirtualFileSystem caller)
	{
		vfs = caller;
	}
	private String dir;
	private String gitDir;
	private Git git;
	Exception lastError;
	//todo add key verification
	@Override
	@JavascriptInterface
	public void setDir(String dir, String gitdir)
	{
		if ((this.dir == null || !this.dir.equals(dir)) || (this.gitDir == null || !this.gitDir.equals(gitdir)))
		{
			if (this.git != null)
			{
				this.git.close();
				this.git = null;
			}
			this.dir = dir;
			this.gitDir = gitdir;
		}
	}
	public Git getRepo()
	{
		if (this.git != null)
		{
			return this.git;
		}
		try
		{
			this.git = Git.wrap(new RepositoryBuilder().setWorkTree(new File(this.dir)).setGitDir(new File(this.gitDir)).build());

		}
		catch (IOException e)
		{
			return null;
		}
		return this.git;
	}

	@JavascriptInterface
	public void dispose()
	{
		if (this.git != null)
		{
			Git git = this.git;
			this.git = null;
			git.close();
		}
	}

	public static String getObjectOid(InputStream stream)
	{	
		try
		{
			MessageDigest md = Constants.newMessageDigest();
			md.update(Constants.encodeASCII(Constants.TYPE_BLOB));
			md.update((byte) ' ');
			md.update(Constants.encodeASCII(stream.available()));
			md.update((byte) 0);
			byte[] o = new byte[4096];
			while (stream.available() > 0)
			{
				int i = stream.read(o);
				md.update(o, 0, i);
			}
			return ObjectId.toString(ObjectId.fromRaw(md.digest()));
		}
		catch (IOException e)
		{
			return null;
		}
	}


	@Override
	@JavascriptInterface
	public void init()
	{
		try
		{
			Git git = Git.init().setDirectory(new File(this.dir)).setGitDir(new File(this.gitDir)).setBare(false).call();
			if (this.git == null)
			{
				this.git = git;
			}
		}
		catch (IllegalStateException e)
		{
			throwError(e);
		}
		catch (GitAPIException e)
		{
			throwError(e);
		}
		catch (Exception e)
		{
			throwError(e);
		}
	}

	@Override
	@JavascriptInterface
	public void clone(String singleBranch, String url, String user, String password, int onProgress)
	{
		try
		{
			CloneCommand d = Git.cloneRepository().
				setURI(new URIish(url).toString()).
				setDirectory(new File(this.dir)).
				setGitDir(new File(this.gitDir)).
				setProgressMonitor(createProgressMonitor(onProgress)).
				setCredentialsProvider(new UsernamePasswordCredentialsProvider(user, password));
			d.setBare(false);
			if (singleBranch != null)
			{
				d.
					setCloneAllBranches(false).
					setBranch(singleBranch);
			}
			if (this.git == null)
			{
				this.git = d.call();
			}
			else d.call();//would likely fail
		}
		catch (URISyntaxException e)
		{
			throwError(e);
		}
		catch (GitAPIException e)
		{
			throwError(e);
		}
		catch (Exception e)
		{
			throwError(e);
		}

	}

	@Override
	public void fetch(String singleBranch, String remoteName, String user, String pass, int onProgress)
	{
		try
		{
			FetchCommand a = getRepo().fetch().
				setCredentialsProvider(new UsernamePasswordCredentialsProvider(user, pass)).
				setProgressMonitor(createProgressMonitor(onProgress)).
				setRemote(remoteName);
			if (singleBranch != null)
			{
				RefSpec refSpec = new RefSpec();
				refSpec.setSourceDestination("refs/heads/" + singleBranch, "refs/remotes/" + remoteName + "/" + singleBranch);
				a.setRefSpecs(new RefSpec[]{refSpec});
			}
			a.call();//todo parse fetch result
		}
		catch (GitAPIException e)
		{
			throwError(e);
		}
		catch (Exception e)
		{
			throwError(e);
		}
	}

	public PersonIdent parsePerson(String json)
	{
		if (json == null)return null;
		try
		{
			JSONObject a = new JSONObject(json);
			String name = a.getString("name");
			String email = a.getString("email");
			if (a.has("timestamp"))
			{
				long when = a.optLong("timestamp") * 1000;
				int timezoneOffset = a.optInt("timezoneOffset") * 60;
				return new PersonIdent(name, email, when, timezoneOffset);	
			}
			return new PersonIdent(name, email);
		}

		catch (JSONException e)
		{
			throwError(e);

		}
		catch (Exception e)
		{
			throwError(e);
		}
		return null;
	}
	public JSONObject encodePerson(PersonIdent pson)
	{
		if (pson == null)return null;
		JSONObject o = null;
		try
		{
			o = new JSONObject();
			o.put("name", pson.getName());
			o.put("email", pson.getEmailAddress());
			o.put("timestamp", pson.getWhen().getTime() / 1000);
			o.put("timezoneOffset", pson.getTimeZoneOffset() / 60);
			return o;
		}
		catch (JSONException e)
		{
			throwError(e);
		}
		catch (Exception e)
		{
			throwError(e);
		}
		return o;
	}

	public void throwError(Exception e)
	{
		this.lastError = e;
		throw new RuntimeException(e);
	}
	@JavascriptInterface
	public String getError()
	{
		if (this.lastError != null)
		{
			StringBuffer h =   (new StringBuffer());
			h.append(this.lastError.getMessage());
			for (StackTraceElement i:
			this.lastError.getStackTrace())
			{
				h.append("\n|->");
				h.append(i.toString());
			}
			return h.toString();
		}
		return "no error";
	}

	@Override
	@JavascriptInterface
	public void checkout(String filepaths, String ref, boolean force, int onProgress)
	{
		CheckoutCommand a =  getRepo().checkout();
		if (filepaths != null)
		{
			a.setAllPaths(false);
			try
			{
				
				JSONArray b = new JSONArray(filepaths);

				for (int i=0;i < b.length();i++)
				{
					a.addPath(b.getString(i));

				}
			}
			catch (JSONException e)
			{
				throwError(e);
			}
			a.setStartPoint(ref);
		}
		else
		{
			a.setName(ref);
		}


		try
		{
			a.setForce(force).call();
		}
		catch (GitAPIException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
	}


	@JavascriptInterface
	@Override
	public void commit(String message, String author)
	{
		try
		{
			getRepo().commit().setMessage(message).setAuthor(parsePerson(author)).setCommitter(parsePerson(author)).call();
		}
		catch (GitAPIException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
	}

	@JavascriptInterface
	@Override
	public void setConfig(String path, String value)
	{
		StoredConfig b = getRepo().getRepository().getConfig();
		String[] a = path.split("\\.");
		String key = a[a.length - 1];
		String section=null,subSection=null;
		//TODO test this
		if (a.length > 1)section = a[0];
		if (a.length > 2)subSection = path.substring(section.length() + 1, path.length() - key.length() - 1);
		b.setString(section, subSection, key, value);
		try
		{
			b.save();
		}
		catch (IOException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
	}

	@JavascriptInterface
	@Override
	public String getConfig(String path)
	{
		Config b = getRepo().getRepository().getConfig();
		String[] a = path.split("\\.");
		String key = a[a.length - 1];
		String section=null,subSection=null;
		if (a.length > 1)section = a[0];
		if (a.length > 2)subSection = a[1];	
		return b.getString(section, subSection, key);
	}

	@JavascriptInterface
	@Override
	public void addRemote(String ref, String url)
	{
		StoredConfig config = getRepo().getRepository().getConfig();
		config.setString("remote", ref, "url", url);
		try
		{
			config.save();
		}
		catch (IOException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
	}

	@JavascriptInterface
	@Override
	public String listRemotes()
	{
		Set<String> remotes = getRepo().getRepository().getRemoteNames();
		JSONArray b = new JSONArray();
		for(String remote: remotes){
			JSONObject o = new JSONObject();
			try
			{
				o.put("remote", remote);
				o.put("url",new String(getConfig("remote."+remote+".url")));
				b.put(o);
			}
			catch (Exception e)
			{
				
			}
		
		}
		return b.toString();
	}

	@JavascriptInterface
	@Override
	public String currentBranch()
	{
		try
		{
			return getRepo().getRepository().getFullBranch();
		}
		catch (IOException e)
		{
			throwError(e);
		}
		catch (Exception e)
		{
			throwError(e);
		}
		return null;
	}

	@JavascriptInterface
	@Override
	public String resolveRef(String ref)
	{
		// TODO: Implement this method
		try
		{
			return ObjectId.toString(getRepo().getRepository().resolve(ref));
		}
		catch (RevisionSyntaxException e)
		{
			throwError(e);
		}
		catch (IOException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
		return null;
	}

	@JavascriptInterface
	@Override
	public void writeRef(String ref, String oid)
	{
		try
		{
			RefUpdate b = getRepo().getRepository().updateRef(ref);
			b.setNewObjectId(ObjectId.fromString(oid));
			b.setForceUpdate(true);
			RefUpdate.Result c = b.update();
			switch (c)
			{
				case FORCED:
				case NEW:
					break;
				default:
					throwError(new Exception("Bad writeRef result " + c.toString()));
			}
		}
		catch (IOException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
	}

	@JavascriptInterface
	@Override
	public String status(String filepath)
	{
		return statusAll("[\"" + filepath + "\"]");
	}

	@JavascriptInterface
	public String statusAll(String filepaths)
	{
		try
		{
			try
			{
				StatusCommand c = getRepo().status();
				if (filepaths != null)
				{
					JSONArray a = new JSONArray(filepaths);
					for (int i=0;i < a.length();i++)
					{
						c.addPath(a.getString(i));	
					}
				}
				Status a = c.call();
				JSONObject obj = new JSONObject();
				//workdir different from index
				obj.put("added",new JSONArray(a.getAdded()));
				obj.put("modified", new JSONArray(a.getModified()));
				//index different from head
				obj.put("changed", new JSONArray(a.getChanged()));
				//in index but not workdir
				obj.put("missing", new JSONArray(a.getMissing()));
				//in head but not index
				obj.put("removed", new JSONArray(a.getRemoved()));
				//not in head or workdir
				obj.put("untracked", new JSONArray(a.getUntracked()));
				//merge conflict, we avoid this
				obj.put("conflicting", new JSONArray(a.getConflicting()));
				//not in head or workdir and ignored
				obj.put("ignored", new JSONArray(a.getIgnoredNotInIndex()));
				//obj.put("unstaged", new JSONArray(a.getUncommittedChanges()));
				return obj.toString();
			}
			catch (JSONException e)
			{
				throwError(e);
			}
		}
		catch (NoWorkTreeException e)
		{
			throwError(e);
		}
		catch (GitAPIException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
		return null;
	}

	@JavascriptInterface
	@Override
	public void add(String filepaths)
	{
		try
		{
			AddCommand a = getRepo().add();
			try
			{
				JSONArray b = new JSONArray(filepaths);

				for (int i=0;i < b.length();i++)
				{
					a.addFilepattern(b.getString(i));

				}
				a.call();
			}
			catch (JSONException e)
			{
				throwError(e);
			}

		}
		catch (GitAPIException e)
		{
			throwError(e);
		}
	}

	@JavascriptInterface
	@Override
	public void remove(String filepaths)
	{
		try
		{
			RmCommand a = getRepo().rm().setCached(true);
			try
			{
				JSONArray b = new JSONArray(filepaths);

				for (int i=0;i < b.length();i++)
				{
					a.addFilepattern(b.getString(i));

				}
				a.call();
			}
			catch (JSONException e)
			{
				throwError(e);
			}
		}
		catch (GitAPIException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
	}

	@JavascriptInterface
	@Override
	public void resetIndex(String filepaths)
	{
		try
		{
			ResetCommand a = getRepo().reset();
			try
			{
				JSONArray b = new JSONArray(filepaths);

				for (int i=0;i < b.length();i++)
				{
					a.addPath(b.getString(i));

				}
				a.call();
			}
			catch (JSONException e)
			{
				throwError(e);
			}
		  

		}
		catch (GitAPIException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
	}

	@JavascriptInterface
	@Override
	public String listFiles(String ref)
	{
		ArrayList<String> files = new ArrayList<String>();
		if (ref == null)
		{
			try
			{
				DirCache a = getRepo().getRepository().readDirCache();
				for (int i =0;i < a.getEntryCount();i++)
				{
					files.add(a.getEntry(i).getPathString());
				}
			}
			catch (NoWorkTreeException e)
			{
				throwError(e);
			}
			catch (IOException e)
			{
				throwError(e);
			}

			catch (Exception e)
			{
				throwError(e);
			}
		}
		else
		{
			try
			{
				Repository rep = getRepo().getRepository();
        		Ref head = rep.getRef(ref);

        		RevWalk walk = new RevWalk(rep);

				RevCommit commit = walk.parseCommit(head.getObjectId());

        		RevTree tree = commit.getTree();
           		TreeWalk treeWalk = new TreeWalk(rep);
        		treeWalk.addTree(tree);
        		treeWalk.setRecursive(true);
        		while (treeWalk.next())
				{
            		files.add(treeWalk.getPathString());
				}
			}
			catch (NoWorkTreeException e)
			{
				throwError(e);
			}
			catch (IOException e)
			{
				throwError(e);
			}

			catch (Exception e)
			{
				throwError(e);
			}
		}
		return new JSONArray(files).toString();
	}

	@JavascriptInterface
	@Override
	public String log()
	{
		try
		{
			Iterable<RevCommit> p = getRepo().log().call();
			JSONArray arr = new JSONArray();
			for (RevCommit o:p)
			{
				JSONObject i = new JSONObject();
				try
				{
					i.put("oid", ObjectId.toString(o.toObjectId()));
					JSONObject com = new JSONObject();

					com.put("author", encodePerson(o.getAuthorIdent()));
					com.put("committer", encodePerson(o.getCommitterIdent()));
					String message = o.getFullMessage();
					if (message.charAt(message.length() - 1) == '\n')
					{
						message = message.substring(0, message.length() - 1);
					}
					com.put("message", message);
					i.put("commit", com);
				}
				catch (JSONException e)
				{
					//Let's ignore this, shall we
				}
				arr.put(i);
			}
			return arr.toString();
		}
		catch (GitAPIException e)
		{ 
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
		return null;
	}

	@JavascriptInterface
	@Override
	public void branch(String ref)
	{
		// TODO: Implement this method
		try
		{
			getRepo().branchCreate().setName(ref).setUpstreamMode(CreateBranchCommand.SetupUpstreamMode.SET_UPSTREAM).call();
		}
		catch (GitAPIException e)
		{}}

	@JavascriptInterface
	@Override
	public void deleteBranch(String ref)
	{
		try
		{
			getRepo().branchDelete().setBranchNames(new String[]{ref}).call();
		}
		catch (GitAPIException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
	}

	@JavascriptInterface
	@Override
	public String listBranches(String remote)
	{
		JSONArray a = new JSONArray();
		try
		{
			if (remote == null)
			{
				List<Ref>  refs =getRepo().branchList().call();
				for (Ref ref:refs)
				{
					a.put(ref.getName());
				}
			}
		}
		catch (GitAPIException e)
		{
			throwError(e);
		}

		catch (Exception e)
		{
			throwError(e);
		}
		return a.toString();
	}

	@Override
	@JavascriptInterface
	public void cached()
	{
		//really does nothing for now
	}

	@Override
	public String analyze(String dir)
	{
		return null;
	}
	@Override
	public void merge(String theirs, int author, String name, String email, boolean dryRun, boolean fastForwardOnly, int onProgress)
	{
		// TODO: Implement this method
	}
	@Override
	public String completeMerge(String ourOid, String theirOid, String ours, String theirs, int author, int committer, String signingKey, String message)
	{
		// TODO: Implement this method
		return null;
	}
	@Override
	public String startMerge(String ourOid, String theirOid, String ours, String theirs, int author, int committer, String signingKey, String message)
	{
		// TODO: Implement this method
		return null;
	}



	private class IProgressMonitor implements ProgressMonitor
	{
		public boolean cancelled;
		public int cb;
		ValueCallback<String> onCancel;
		public int tasks;
		public IProgressMonitor(int onProgress)
		{
			cb = onProgress;
			onCancel = new ValueCallback<String>(){
				@Override
				public void onReceiveValue(String p1)
				{
					if (p1.equals("false"))
					{
						cancelled = false;
					}
				}
			};
		}
		@Override
		public void start(int p1)
		{
			tasks = p1;
			try
			{
				vfs.callWebCallback(cb, new JSONArray(new String[]{"Starting"}), onCancel);
			}
			catch (JSONException e)
			{
			}
		}

		@Override
		public void beginTask(String p1, int p2)
		{
			JSONArray a = new JSONArray();
			a.put(p1);
			a.put(p2);
			vfs.callWebCallback(cb, a, onCancel);
		}

		@Override
		public void update(int p1)
		{

		}

		@Override
		public void endTask()
		{
			if (--tasks <= 0)
			{
				try
				{
					vfs.callWebCallback(cb, new JSONArray(new String[]{"Finishing"}), onCancel);
				}
				catch (JSONException e)
				{}
			}
		}

		@Override
		public boolean isCancelled()
		{
			return cancelled;
		}
	}
	private ProgressMonitor createProgressMonitor(final int onProgress)
	{
		return new IProgressMonitor(onProgress);
	}


}
