import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { patientService } from '@/lib/services/patientService';
import { useToast } from '@/hooks/use-toast';
import type { PatientCreate } from '@/types/api';

interface CreatePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePatientDialog({ open, onOpenChange }: CreatePatientDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<PatientCreate>({
    full_name: '',
    date_of_birth: '',
    condition: '',
    status: 'active',
    notes: '',
  });

  const createPatientMutation = useMutation({
    mutationFn: (data: PatientCreate) => patientService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({
        title: 'Success',
        description: 'Patient created successfully',
      });
      // Reset form
      setFormData({
        full_name: '',
        date_of_birth: '',
        condition: '',
        status: 'active',
        notes: '',
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Patient creation error:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message || 'Failed to create patient';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast({
        title: 'Error',
        description: 'Patient name is required',
        variant: 'destructive',
      });
      return;
    }
    createPatientMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Patient</DialogTitle>
          <DialogDescription>
            Add a new patient to your practice. All fields are optional except name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
              required
              disabled={createPatientMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth || ''}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              disabled={createPatientMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <Input
              id="condition"
              value={formData.condition || ''}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              placeholder="e.g., Lower back pain, Knee rehabilitation"
              disabled={createPatientMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value as 'active' | 'on_hold' | 'discharged' })
              }
              disabled={createPatientMutation.isPending}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="discharged">Discharged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about the patient..."
              rows={3}
              disabled={createPatientMutation.isPending}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createPatientMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createPatientMutation.isPending}>
              {createPatientMutation.isPending ? 'Creating...' : 'Create Patient'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

