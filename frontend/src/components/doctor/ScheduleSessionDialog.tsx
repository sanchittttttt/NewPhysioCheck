import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/context/SessionContext';
import { useProtocol } from '@/context/ProtocolContext';
import { getDemoUser, getDoctorPatients, DemoUser } from '@/lib/demoAuth';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

interface ScheduleSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId?: string;
}

export function ScheduleSessionDialog({ open, onOpenChange, patientId: initialPatientId }: ScheduleSessionDialogProps) {
  const { toast } = useToast();
  const { createSession } = useSession();
  const { protocols } = useProtocol();
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || '');
  const [selectedProtocolId, setSelectedProtocolId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Patients from Supabase
  const [patients, setPatients] = useState<DemoUser[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<DemoUser | null>(null);

  // Update selectedPatientId when initialPatientId changes
  useEffect(() => {
    if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
    }
  }, [initialPatientId]);

  // Fetch patients from Supabase
  useEffect(() => {
    const fetchPatients = async () => {
      const user = getDemoUser();
      if (user?.role === 'doctor') {
        const doctorPatients = await getDoctorPatients(user.id);
        setPatients(doctorPatients);

        // Find selected patient if we have an initial ID
        if (initialPatientId) {
          const found = doctorPatients.find(p => p.id === initialPatientId);
          setSelectedPatient(found || null);
        }
      }
      setPatientsLoading(false);
    };

    if (open) {
      fetchPatients();
    }
  }, [open, initialPatientId]);

  // Update selected patient when patient ID changes
  useEffect(() => {
    if (selectedPatientId && patients.length > 0) {
      const found = patients.find(p => p.id === selectedPatientId);
      setSelectedPatient(found || null);
    }
  }, [selectedPatientId, patients]);

  // All protocols are available to assign in demo mode
  const assignedProtocols = protocols;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedProtocolId || !sessionDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createSession({
        patient_id: selectedPatientId,
        protocol_id: selectedProtocolId,
        date: sessionDate,
        notes
      });

      if (result) {
        toast({
          title: 'Success',
          description: 'Session scheduled successfully',
        });

        // Reset
        if (!initialPatientId) setSelectedPatientId('');
        setSelectedProtocolId('');
        setSessionDate('');
        setNotes('');
        onOpenChange(false);
      } else {
        throw new Error('Failed to create session');
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to schedule session",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Session</DialogTitle>
          <DialogDescription>
            Create a new session for a patient. The patient will be able to view and start it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!initialPatientId && (
            <div className="space-y-2">
              <Label htmlFor="patient">Patient *</Label>
              {patientsLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading patients...
                </div>
              ) : patients.length === 0 ? (
                <div className="px-3 py-2 text-muted-foreground text-sm">
                  No patients found. Add patients first.
                </div>
              ) : (
                <select
                  id="patient"
                  value={selectedPatientId}
                  onChange={(e) => {
                    setSelectedPatientId(e.target.value);
                    setSelectedProtocolId('');
                  }}
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg"
                  required
                  disabled={isSubmitting}
                >
                  <option value="">Select a patient...</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} ({patient.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {initialPatientId && (
            <div className="space-y-2">
              <Label htmlFor="patient">Patient</Label>
              <div className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-muted-foreground">
                {selectedPatient?.name || 'Loading...'}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="protocol">Protocol *</Label>
            <select
              id="protocol"
              value={selectedProtocolId}
              onChange={(e) => setSelectedProtocolId(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg"
              required
              disabled={!selectedPatientId || isSubmitting}
            >
              <option value="">
                {!selectedPatientId ? 'Select patient first...' : assignedProtocols.length === 0 ? 'No protocols available' : 'Select a protocol...'}
              </option>
              {assignedProtocols.map((protocol) => (
                <option key={protocol.id} value={protocol.id}>
                  {protocol.title}
                </option>
              ))}
            </select>
            {selectedPatientId && assignedProtocols.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No protocols created yet. Create a protocol in Protocol Builder first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Session notes..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedPatientId || !selectedProtocolId || !sessionDate}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Schedule Session'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
