import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STORAGE_KEY = "hf:coffee-opened";

export function CoffeeUpsellButton() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setHasOpened(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const handleOpen = () => {
    setOpen(true);
    if (!hasOpened) {
      localStorage.setItem(STORAGE_KEY, "1");
      setHasOpened(true);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject: "Free coffee sample request",
          category: "coffee_sample",
          status: "open",
          source: "in_app",
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase.from("support_ticket_messages").insert({
        ticket_id: ticket.id,
        user_id: userId,
        author_type: "user",
        body: `Name: ${name}\nAddress: ${address}\nNotes: ${notes || "(none)"}`,
      });

      toast.success("Coffee's on the way ☕");
      setOpen(false);
      setName("");
      setAddress("");
      setNotes("");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        title="Get hyped — free coffee sample"
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white grid place-items-center shadow-xl hover:scale-105 transition-transform ${
          hasOpened ? "" : "animate-pulse ring-4 ring-amber-400/40"
        }`}
      >
        <Coffee className="w-5 h-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Get Hyped <span className="text-amber-500">☕</span>
            </DialogTitle>
            <DialogDescription>
              Try our coffee — on us. Tell us where to send a free sample.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-address">Shipping address</Label>
              <Textarea
                id="c-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-notes">Roast preference (optional)</Label>
              <Input id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Sending…" : "Send my free sample"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
