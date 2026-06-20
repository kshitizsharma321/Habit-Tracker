import { useState, useEffect, useRef, useMemo } from 'react';
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
  const { definitions, defsLoading, createHabit, isCreating, updateHabit, isUpdating, deleteHabit, isDeleting, reorderHabits, isReordering } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'add' ? 'add' : 'list');
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState({
    name: '', trackingType: 'completion',
    unit: '', goalEnabled: false, goalValue: 1, goalDirection: 'at_least',
    color: '#22c55e', icon: '⭐',
  });

  const existingNames = useMemo(
    () => new Set(definitions.map((d) => d.name.trim().toLowerCase())),
    [definitions],
  );

  const resetForm = () => {
    setForm({ name: '', trackingType: 'completion', unit: '', goalEnabled: false, goalValue: 1, goalDirection: 'at_least', color: '#22c55e', icon: '⭐' });
    setEditingId(null);
  };

  const startEdit = (def) => {
    setForm({
      name: def.name, trackingType: def.trackingType,
      unit: def.unit || '', goalEnabled: def.goal?.enabled || false,
      goalValue: def.goal?.value || 1,
      goalDirection: def.goal?.direction || 'at_least',
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
      goalDirection: 'at_least',
      color: tpl.color || '#22c55e', icon: tpl.icon || '⭐',
    });
    setEditingId(null);
    setActiveTab('add');
  };

  // Deep-link: /manage?edit=<id> opens that habit directly in the edit form (once).
  const editHandledRef = useRef(false);
  useEffect(() => {
    if (editHandledRef.current) return;
    const editId = searchParams.get('edit');
    if (editId && definitions.length) {
      const def = definitions.find((d) => d._id === editId);
      if (def) {
        startEdit(def);
        editHandledRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, definitions]);

  const handleSave = async () => {
    const profile = {
      name: form.name.trim(), trackingType: form.trackingType, color: form.color, icon: form.icon,
      unit: form.trackingType === 'quantity' ? form.unit : undefined,
    };
    if (form.trackingType === 'quantity') {
      const goalVal = Math.round((parseFloat(form.goalValue) || 0) * 100) / 100;
      if (goalVal <= 0) return; // guard — Save button is disabled, but never submit an invalid target
      profile.goal = { enabled: true, value: goalVal, direction: form.goalDirection || 'at_least' };
    } else {
      profile.goal = { enabled: false, value: 1 };
    }

    if (editingId) {
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

  const isSaving = isCreating || isUpdating;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Habits</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="list">Your Habits</TabsTrigger>
          <TabsTrigger value="add">{editingId ? 'Edit' : 'New'}</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <HabitList definitions={definitions} startEdit={startEdit} setDeleteTarget={setDeleteTarget} loading={defsLoading} reorderHabits={reorderHabits} isReordering={isReordering} />
        </TabsContent>

        <TabsContent value="add">
          <HabitForm form={form} setForm={setForm} handleSave={handleSave} isSaving={isSaving} editingId={editingId} resetForm={resetForm} />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateList
            applyTemplate={applyTemplate}
            existingNames={existingNames}
            onAddCustom={() => { resetForm(); setActiveTab('add'); }}
          />
        </TabsContent>
      </Tabs>

      <DeleteDialog habit={deleteTarget} isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isDeleting={isDeleting} />
    </div>
  );
}
