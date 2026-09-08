package hotel.shanshui.validation;

import android.content.Context;
import android.graphics.*;
import android.graphics.pdf.PdfDocument;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.*;
import java.util.*;

final class StageExport {
    static final String FONT = "public/fonts/NotoSansSC.ttf";
    static String dish(int i) { return String.format(Locale.ROOT,"%02d ",i+1) + (i%3==0 ? "石斛花旗参慢炖老鸡汤（长中文菜名与自动换行验证）" : i%3==1 ? "清蒸鲜鱼配时蔬" : "锦绣团圆点心拼盘"); }
    private final Context context;
    StageExport(Context context) {this.context=context;}
    JSObject generate(JSObject frozen,String template) throws Exception {
        if (!Arrays.asList("kitchen","receipt","photo").contains(template)) throw new IllegalArgumentException("Unknown template");
        final boolean photo=template.equals("photo"), chef=template.equals("kitchen");
        final int width=595,height=842,margin=45;
        org.json.JSONArray supplied=frozen.optJSONArray("lines"); final int rows=supplied==null?frozen.getInt("rows"):supplied.length();
        TextPaint paint=new TextPaint(Paint.ANTI_ALIAS_FLAG);
        paint.setTypeface(Typeface.createFromAsset(context.getAssets(),FONT)); paint.setColor(Color.rgb(40,38,33)); paint.setTextSize(16);
        List<List<Integer>> pages=new ArrayList<>(); List<Integer> page=new ArrayList<>();int y=135;
        for(int i=0;i<rows;i++) {
            int h=photo?122:layout(dish(i),paint,width-2*margin).getHeight()+16;
            if(y+h>height-55 && !page.isEmpty()) {pages.add(page);page=new ArrayList<>();y=135;}
            page.add(i);y+=h;
        }
        if(!page.isEmpty())pages.add(page);
        File root=new File(context.getFilesDir(),"exports");if(!root.exists()&&!root.mkdirs())throw new IOException("Cannot create export directory");
        String stem="stage1-v"+frozen.getInt("revision")+"-"+template+"-"+UUID.randomUUID().toString().substring(0,8);
        JSArray names=new JSArray();List<File> completed=new ArrayList<>();long peak=0;
        File pdf=new File(root,stem+".pdf");
        Bitmap fixture=null;
        PdfDocument document=new PdfDocument();
        try {
            // Decode one bundled synthetic image, not any production media.
            if(photo) try(InputStream input=context.getAssets().open("public/fixture.png")){fixture=BitmapFactory.decodeStream(input);if(fixture==null)throw new IOException("Fixture decode failed");}
            for(int p=0;p<pages.size();p++) {
                PdfDocument.Page pdfPage=document.startPage(new PdfDocument.PageInfo.Builder(width,height,p+1).create());
                try {draw(pdfPage.getCanvas(),pages.get(p),paint,fixture,frozen,template,p+1,pages.size());}
                finally {document.finishPage(pdfPage);}
                Bitmap bitmap=Bitmap.createBitmap(1190,1684,Bitmap.Config.ARGB_8888);
                peak=Math.max(peak,bitmap.getAllocationByteCount()+(fixture==null?0:fixture.getAllocationByteCount()));
                File png=new File(root,stem+"-"+(p+1)+".png");completed.add(png);
                try {
                    Canvas canvas=new Canvas(bitmap);canvas.scale(2,2);draw(canvas,pages.get(p),paint,fixture,frozen,template,p+1,pages.size());
                    try(FileOutputStream out=new FileOutputStream(png)){if(!bitmap.compress(Bitmap.CompressFormat.PNG,100,out))throw new IOException("PNG failed");out.getFD().sync();}
                    BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeFile(png.getPath(),bounds);
                    if(bounds.outWidth!=1190||bounds.outHeight!=1684)throw new IOException("PNG reopen failed");
                    names.put(png.getName());
                } finally {bitmap.recycle();}
            }
            completed.add(pdf);
            try(FileOutputStream out=new FileOutputStream(pdf)){document.writeTo(out);out.getFD().sync();}
            int count;
            try(ParcelFileDescriptor fd=ParcelFileDescriptor.open(pdf,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer renderer=new PdfRenderer(fd)){count=renderer.getPageCount();}
            if(count!=pages.size())throw new IOException("PDF page count mismatch");
            names.put(pdf.getName());JSObject result=new JSObject();result.put("files",names);result.put("pages",pages.size());result.put("pdfPages",count);result.put("peakBitmapBytes",peak);result.put("rows",rows);return result;
        } catch(Exception|OutOfMemoryError e) {
            for(File f:completed)if(f.exists())f.delete();
            throw new IOException("导出失败，未发布不完整文件",e);
        } finally {try{document.close();}finally{if(fixture!=null)fixture.recycle();}}
    }
    private static StaticLayout layout(String s,TextPaint paint,int width){return StaticLayout.Builder.obtain(s,0,s.length(),paint,width).setAlignment(Layout.Alignment.ALIGN_NORMAL).setIncludePad(false).build();}
    private static void text(Canvas canvas,String s,TextPaint paint,int x,int y,int width){canvas.save();canvas.translate(x,y);layout(s,paint,width).draw(canvas);canvas.restore();}
    private static void draw(Canvas c,List<Integer> rows,TextPaint p,Bitmap image,JSObject frozen,String template,int page,int count) {
        boolean chef=template.equals("kitchen"),photo=template.equals("photo");
        c.drawColor(Color.WHITE);p.setTextSize(22);
        String title=frozen.optString("title",chef?"厨房询价 · 合成菜单":photo?"宴席菜单 · 有图样例":"宴席菜单 · 无图小票");text(c,title,p,45,35,505);
        p.setTextSize(13);
        text(c,chef?"待核价 / "+frozen.optString("request")+" / 非备餐指令":"当前对客报价 ¥"+String.format(Locale.ROOT,"%.2f",frozen.optLong("amount")/100.0)+" / 桌",p,45,72,505);
        text(c,chef?"核价备注：合成样例，无客户资料":"内部技术验证样例，无真实客户资料",p,45,96,505);
        int y=135;p.setTextSize(16);
        for(int i:rows) {
            String name=frozen.optJSONArray("lines")==null?dish(i):frozen.optJSONArray("lines").optString(i);if(photo) {c.drawBitmap(image,null,new Rect(45,y,165,y+90),p);text(c,name,p,185,y+8,365);y+=122;}
            else {StaticLayout l=layout(name,p,505);text(c,name,p,45,y,505);y+=l.getHeight()+16;}
        }
        p.setTextSize(11);text(c,"第 "+page+" / "+count+" 页 · STAGE1",p,45,805,505);
    }
}

