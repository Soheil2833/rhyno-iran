"use client"

import { useState } from "react"
import { addRequestNote } from "@/app/actions/finance-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, History } from "lucide-react"
import { toast } from "sonner"

export function RequestNotes({
  requestId,
  notes
}: {
  requestId: string
  notes: any[]
}) {
  const [newNote, setNewNote] = useState("")
  const [isSending, setIsSending] = useState(false)

  const handleSend = async () => {
    if (!newNote.trim()) return
    setIsSending(true)
    const res = await addRequestNote(requestId, newNote)
    setIsSending(false)

    if (res.success) {
      setNewNote("")
      toast.success("یادداشت ثبت شد")
    } else {
      toast.error("خطا در ثبت")
    }
  }

  return (
    <div className="mt-4 border-t pt-2">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
        <History className="size-3" /> تاریخچه اقدامات
      </div>

      {/* لیست پیام‌ها */}
      <ScrollArea className="mb-2 h-24 w-full rounded border bg-white p-2 text-xs">
        {notes.length === 0 ? (
          <p className="mt-4 text-center text-gray-300">
            هنوز اقدامی ثبت نشده است
          </p>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              className="mb-2 border-b pb-1 last:mb-0 last:border-0"
            >
              <span className="font-bold text-blue-700">
                {note.profiles?.display_name || "کاربر"}:
              </span>{" "}
              <span className="text-gray-700">{note.content}</span>
              <div
                className="mt-0.5 text-left text-[10px] text-gray-400"
                dir="ltr"
              >
                {new Date(note.created_at).toLocaleString("fa-IR")}
              </div>
            </div>
          ))
        )}
      </ScrollArea>

      {/* ورودی پیام جدید */}
      <div className="flex gap-1">
        <Input
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          placeholder="توضیحات (مثلا: تماس گرفتم...)"
          className="h-8 text-xs"
        />
        <Button
          size="icon"
          className="size-8"
          onClick={handleSend}
          disabled={isSending}
        >
          <Send className="size-3" />
        </Button>
      </div>
    </div>
  )
}
