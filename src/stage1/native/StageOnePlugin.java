package hotel.shanshui.validation;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.*;
import android.graphics.Typeface;
import android.os.SystemClock;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.util.concurrent.*;

@CapacitorPlugin(name="StageOne")
public class StageOnePlugin extends Plugin {
    private StageStore store;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private long sessionUntil;
    @Override public void load(){store=new StageStore(getContext());}
    interface Work {JSObject run() throws Exception;}
    private void perform(PluginCall call,Work work){worker.execute(()->{try{call.resolve(work.run());}catch(Exception e){call.reject(e.getMessage(),e);}});}
    @PluginMethod public void read(PluginCall call){perform(call,()->store.read());}
    @PluginMethod public void write(PluginCall call){perform(call,()->store.write(call.getInt("amount",-1).longValue(),call.getInt("rows",0),call.getBoolean("fail",false)));}
    @PluginMethod public void restrict(PluginCall call){perform(call,()->{store.requireSales();JSObject result=store.setRestricted(true);sessionUntil=SystemClock.elapsedRealtime()+30*60*1000;return result;});}
    @PluginMethod public void recover(PluginCall call){
        if("session".equals(call.getString("method"))) {
            perform(call,()->{if(sessionUntil==0||SystemClock.elapsedRealtime()>sessionUntil)throw new IllegalStateException("会话已结束，请使用设备凭证恢复");return store.setRestricted(false);});
        } else if("credential".equals(call.getString("method"))) {
            KeyguardManager km=(KeyguardManager)getContext().getSystemService(Context.KEYGUARD_SERVICE);
            if(!km.isDeviceSecure()){call.reject("请先在 Android 设置中配置锁屏凭证；冷启动不提供绕过验证");return;}
            Intent intent=km.createConfirmDeviceCredentialIntent("恢复销售工作态","验证本机锁屏凭证");
            if(intent==null){call.reject("设备凭证验证不可用");return;}
            startActivityForResult(call,intent,"credentialResult");
        } else call.reject("未知恢复方式");
    }
    @ActivityCallback private void credentialResult(PluginCall call,ActivityResult result){
        if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK){call.reject("已取消，保持客户受限状态");return;}
        perform(call,()->{sessionUntil=SystemClock.elapsedRealtime()+30*60*1000;return store.setRestricted(false);});
    }
    @PluginMethod public void checks(PluginCall call){perform(call,()->{
        store.requireSales();JSObject before=store.read();boolean rollback=false;
        try{store.write(100,100,true);}catch(IllegalStateException expected){rollback=before.toString().equals(store.read().toString());}
        Typeface font=Typeface.createFromAsset(getContext().getAssets(),StageExport.FONT);
        JSObject result=new JSObject();result.put("rollback",rollback);result.put("integrity",store.integrity());result.put("bundledFontLoaded",font!=null);
        result.put("android",android.os.Build.VERSION.RELEASE);result.put("model",android.os.Build.MODEL);result.put("maxJavaHeapBytes",Runtime.getRuntime().maxMemory());
        result.put("note","字体缺字、WebView 排版与低内存仍需真机检查；本检查不等于全部通过");return result;
    });}
    @PluginMethod public void exportMenu(PluginCall call){perform(call,()->{
        store.requireSales();String template=call.getString("template","");JSObject state=store.read(),document=new JSObject();
        document.put("rows",state.optInt("rows"));document.put("revision",state.optInt("revision"));
        if("kitchen".equals(template))document.put("request",state.optString("request"));
        else document.put("amount",state.optLong("amount"));
        return new StageExport(getContext()).generate(document,template);
    });}
    private File exportFile(String name) throws IOException {
        if(name==null||!name.matches("stage1-[a-zA-Z0-9.-]+\\.(png|pdf)"))throw new IOException("Invalid export name");
        File root=new File(getContext().getFilesDir(),"exports").getCanonicalFile();File f=new File(root,name).getCanonicalFile();
        if(!root.equals(f.getParentFile())||!f.isFile())throw new IOException("导出文件不存在");return f;
    }
    private String mime(File f){return f.getName().endsWith(".pdf")?"application/pdf":"image/png";}
    @PluginMethod public void openFile(PluginCall call){perform(call,()->{
        store.requireSales();File f=exportFile(call.getString("name"));Intent intent=new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",f),mime(f));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);getContext().startActivity(intent);return new JSObject();
    });}
    @PluginMethod public void saveFile(PluginCall call){
        try{store.requireSales();File f=exportFile(call.getString("name"));Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(mime(f));intent.putExtra(Intent.EXTRA_TITLE,f.getName());startActivityForResult(call,intent,"saveResult");}
        catch(Exception e){call.reject(e.getMessage(),e);}
    }
    @ActivityCallback private void saveResult(PluginCall call,ActivityResult result){
        if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){call.reject("已取消保存，原导出文件保留");return;}
        perform(call,()->{
            store.requireSales();File f=exportFile(call.getString("name"));
            try(InputStream in=new FileInputStream(f);OutputStream out=getContext().getContentResolver().openOutputStream(result.getData().getData(),"wt")){
                if(out==null)throw new IOException("无法打开目标文件");byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);out.flush();
            }
            JSObject o=new JSObject();o.put("saved",true);return o;
        });
    }
}
