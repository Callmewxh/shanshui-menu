package hotel.shanshui.validation;

import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.concurrent.*;

/** Deliberately narrow persistence bridge. Web code submits a validated repository snapshot; it never sends SQL. */
@CapacitorPlugin(name="StageThree") public class StageThreePlugin extends Plugin {
  private StageThreeStore store; private final ExecutorService worker=Executors.newSingleThreadExecutor();
  @Override public void load(){store=new StageThreeStore(getContext());}
  private void run(PluginCall call, Callable<JSObject> task){worker.execute(()->{try{call.resolve(task.call());}catch(Exception error){call.reject(error.getMessage(),error);}});}
  @PluginMethod public void read(PluginCall call){run(call,()->store.read());}
  @PluginMethod public void commit(PluginCall call){run(call,()->store.commit(call.getString("payload"),call.getInt("baseRevision",-1)));}
  @PluginMethod public void reset(PluginCall call){run(call,()->{store.reset();return new JSObject().put("reset",true);});}
  @PluginMethod public void exportDocument(PluginCall call){run(call,()->new StageExport(getContext()).generate(new JSObject(call.getString("document")),call.getString("template")));}
}
