import { useEffect, useState } from "react";
import { EditorContent, useEditor, Node, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Code, Heading2, ImageIcon, Italic, Link2, List, ListOrdered,
  MousePointerClick, Redo2, Underline as UnderlineIcon, Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeEmailHtml } from "@/lib/email-automation";
import { cn } from "@/lib/utils";

const BTN_STYLE =
  "display:inline-block;background:#fc600b;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold";

/** Nút bấm trong email (thẻ <a> có style inline để hiển thị đúng trong hộp thư). */
const EmailButton = Node.create({
  name: "emailButton",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ href: { default: "#" }, label: { default: "Bấm vào đây" } }),
  parseHTML: () => [
    { tag: "a[data-email-button]", getAttrs: (el) => ({ href: (el as HTMLElement).getAttribute("href"), label: (el as HTMLElement).textContent }) },
    { tag: 'a[style*="background"]', priority: 60, getAttrs: (el) => ({ href: (el as HTMLElement).getAttribute("href"), label: (el as HTMLElement).textContent }) },
  ],
  renderHTML: ({ HTMLAttributes, node }) => [
    "a",
    mergeAttributes({ "data-email-button": "1", style: BTN_STYLE, href: HTMLAttributes.href }),
    node.attrs.label as string,
  ],
});

interface Props {
  value: string;
  onChange: (html: string) => void;
  variables: [string, string][];
}

export const EmailEditor = ({ value, onChange, variables }: Props) => {
  const [source, setSource] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      EmailButton,
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: { attributes: { class: "prose prose-sm max-w-none min-h-[260px] p-3 focus:outline-none" } },
  });

  useEffect(() => {
    if (editor && !source && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor, source]);

  if (!editor) return null;
  const tb = (active: boolean, onClick: () => void, Icon: typeof Bold, title: string) => (
    <Button type="button" size="icon" variant="ghost" title={title} aria-label={title} onClick={onClick}
      className={cn("h-9 w-9", active && "bg-muted text-[#0e2d58]")}>
      <Icon className="h-4 w-4" />
    </Button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
        {tb(editor.isActive("bold"), () => c().toggleBold().run(), Bold, "Đậm")}
        {tb(editor.isActive("italic"), () => c().toggleItalic().run(), Italic, "Nghiêng")}
        {tb(editor.isActive("underline"), () => c().toggleUnderline().run(), UnderlineIcon, "Gạch chân")}
        {tb(editor.isActive("heading", { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), Heading2, "Tiêu đề")}
        {tb(editor.isActive("bulletList"), () => c().toggleBulletList().run(), List, "Danh sách")}
        {tb(editor.isActive("orderedList"), () => c().toggleOrderedList().run(), ListOrdered, "Danh sách số")}
        {tb(editor.isActive({ textAlign: "left" }), () => c().setTextAlign("left").run(), AlignLeft, "Căn trái")}
        {tb(editor.isActive({ textAlign: "center" }), () => c().setTextAlign("center").run(), AlignCenter, "Căn giữa")}
        {tb(editor.isActive({ textAlign: "right" }), () => c().setTextAlign("right").run(), AlignRight, "Căn phải")}
        {tb(editor.isActive("link"), () => {
          const url = window.prompt("Địa chỉ liên kết (https://… hoặc {{link_loi_moi}})", editor.getAttributes("link").href ?? "https://");
          if (url === null) return;
          if (url === "") c().unsetLink().run();
          else c().extendMarkRange("link").setLink({ href: url }).run();
        }, Link2, "Liên kết")}
        {tb(false, () => {
          const src = window.prompt("Địa chỉ ảnh (https://…)");
          if (src && /^https?:\/\//.test(src)) c().setImage({ src }).run();
        }, ImageIcon, "Chèn ảnh")}
        {tb(false, () => {
          const label = window.prompt("Chữ trên nút", "Mở ONHRM");
          if (!label) return;
          const href = window.prompt("Liên kết của nút", "{{link_app}}") ?? "#";
          c().insertContent({ type: "emailButton", attrs: { label, href } }).run();
        }, MousePointerClick, "Chèn nút")}
        {tb(false, () => c().undo().run(), Undo2, "Hoàn tác")}
        {tb(false, () => c().redo().run(), Redo2, "Làm lại")}
        {tb(source, () => {
          if (source) editor.commands.setContent(sanitizeEmailHtml(value));
          setSource((v) => !v);
        }, Code, "Sửa HTML")}
        <select
          aria-label="Chèn biến"
          className="ml-auto h-9 rounded-md border bg-background px-2 text-base sm:text-sm"
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            const token = `{{${e.target.value}}}`;
            if (source) onChange(value + token);
            else c().insertContent(token).run();
          }}
        >
          <option value="">+ Chèn biến…</option>
          {variables.map(([k, l]) => (
            <option key={k} value={k}>{l} — {`{{${k}}}`}</option>
          ))}
        </select>
      </div>
      {source ? (
        <Textarea className="min-h-[260px] rounded-none border-0 font-mono text-base sm:text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
};
