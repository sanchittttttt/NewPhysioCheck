import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/context/SessionContext';
import { useProtocol } from '@/context/ProtocolContext';
import { useNavigate } from 'react-router-dom';

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

  // Update selectedPatientId when initialPatientId changes
  useEffect(() => {
    if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
    }
  }, [initialPatientId]);

  // DUMMY PATIENTS
  const patients = [
    { id: 'patient-1', full_name: 'Demo Patient', condition: 'ACL Recovery' },
    { id: 'patient-2', full_name: 'John Doe', condition: 'Shoulder Rehab' }
  ];

  // In dummy mode, all protocols are available to assign
  // Filter out any without names if necessary, though our dummy ones have names
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
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      createSession({
        patientId: selectedPatientId,
        protocolId: selectedProtocolId,
        date: sessionDate, // YYYY-MM-DD
        notes
      });

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
              <select
                id="patient"
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setSelectedProtocolId(''); // Reset protocol when patient changes
                }}
                className="w-full px-3 py-2 bg-card border border-border rounded-lg"
                required
                disabled={isSubmitting}
              >
                <option value="">Select a patient...</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.full_name} ({patient.condition || 'No condition'})
                  </option>
                ))}
              </select>
            </div>
          )}
          {initialPatientId && (
            <div className="space-y-2">
              <Label htmlFor="patient">Patient</Label>
              <div className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-muted-foreground">
                {patients.find(p => p.id === initialPatientId)?.full_name || 'Loading...'}
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
                {!selectedPatientId ? 'Select patient first...' : assignedProtocols.length === 0 ? 'No assigned protocols' : 'Select a protocol...'}
              </option>
              {assignedProtocols.map((protocol) => (
                <option key={protocol.id} value={protocol.id}>
                  {protocol.name}
                </option>
              ))}
            </select>
            {selectedPatientId && assignedProtocols.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No protocols assigned to this patient. Assign a protocol first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                disabled={isSubmitting}
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
            <Button type="submit" disabled={isSubmitting || !selectedPatientId || !selectedProtocolId}>
              {isSubmitting ? 'Scheduling...' : 'Schedule Session'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

