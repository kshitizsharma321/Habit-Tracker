import { useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';

import HabitList from '../components/ManageHabits/HabitList';
import HabitForm from '../components/ManageHabits/HabitForm';
import TemplateList from '../components/ManageHabits/TemplateList';

function DeleteDialog({ habit, isOpen, onClose, onConfirm, isDeleting }) {
  if (!habit) return null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Habit?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{habit.icon} {habit.name}</strong> and all its entries. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ManagePage() {
  const { definitions, defsLoading, createHabit, isCreating, updateHabit, isUpdating, deleteHabit, isDeleting, changeType, isTypeChanging } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'add' ? 'add' : 'list');
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState({
    name: '', trackingType: 'completion',
    unit: '', goalEnabled: false, goalValue: 1,
    color: '#22c55e', icon: '⭐',
  });

  const editingDef = editingId ? definitions.find((d) => d._id === editingId) : null;

  const resetForm = () => {
    setForm({ name: '', trackingType: 'completion', unit: '', goalEnabled: false, goalValue: 1, color: '#22c55e', icon: '⭐' });
    setEditingId(null);
  };

  const startEdit = (def) => {
    setForm({
      name: def.name, trackingType: def.trackingType,
      unit: def.unit || '', goalEnabled: def.goal?.enabled || false,
      goalValue: def.goal?.value || 1,
      color: def.color || '#22c55e', icon: def.icon || '⭐',
    });
    setEditingId(def._id);
    setActiveTab('add');
  };

  const applyTemplate = (tpl) => {
    setForm({
      name: tpl.name, trackingType: tpl.type,
      unit: tpl.unit || '',
      goalEnabled: tpl.type === 'quantity',
      goalValue: tpl.goal?.value || 1,
      color: tpl.color || '#22c55e', icon: tpl.icon || '⭐',
    });
    setEditingId(null);
    setActiveTab('add');
  };

  const handleSave = async () => {
    const profile = {
      name: form.name.trim(), trackingType: form.trackingType, color: form.color, icon: form.icon,
      unit: form.trackingType === 'quantity' ? form.unit : undefined,
    };
    if (form.trackingType === 'quantity') {
      const goalVal = Math.max(0, parseFloat(form.goalValue) || 0);
      profile.goal = { enabled: true, value: goalVal };
    } else {
      profile.goal = { enabled: false, value: 1 };
    }

    if (editingId) {
      if (form.trackingType !== editingDef.trackingType) {
        changeType({
          id: editingId,
          data: { newType: form.trackingType, unit: form.unit },
        });
        updateHabit({ id: editingId, data: profile });
        resetForm();
        setActiveTab('list');
        return;
      }
      updateHabit({ id: editingId, data: profile });
      resetForm();
      setActiveTab('list');
    } else {
      createHabit(profile);
      resetForm();
      setActiveTab('list');
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteHabit(deleteTarget._id);
    setDeleteTarget(null);
  };

  const handleTabChange = (tab) => {
    if (tab !== 'add' && editingId) resetForm();
    setActiveTab(tab);
  };

  const isSaving = isCreating || isUpdating || isTypeChanging;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Manage Habits</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="list">Your Habits</TabsTrigger>
          <TabsTrigger value="add">{editingId ? 'Edit' : 'New'}</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <HabitList definitions={definitions} startEdit={startEdit} setDeleteTarget={setDeleteTarget} loading={defsLoading} />
        </TabsContent>

        <TabsContent value="add">
          <HabitForm form={form} setForm={setForm} handleSave={handleSave} isSaving={isSaving} editingId={editingId} resetForm={resetForm} />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateList applyTemplate={applyTemplate} />
        </TabsContent>
      </Tabs>

      <DeleteDialog habit={deleteTarget} isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isDeleting={isDeleting} />
    </div>
  );
}
