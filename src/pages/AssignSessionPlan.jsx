import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserCheck, Calendar, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function AssignSessionPlan() {
  const { user } = useAuth(); // [Fix P.1] user from AuthContext — no per-page auth.me()
  const [plan, setPlan] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [targetDate, setTargetDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const planId = urlParams.get('planId');

  useEffect(() => {
    // [Fix P.1] Wait for both planId and AuthContext user
    if (planId && user) {
      loadData();
    }
  }, [planId, user]);

  const loadData = async () => {
    try {
      if (!user) return; // [Fix P.1] AuthContext still loading
      const userData = user;

      // Check if user is instructor or admin
      if (userData.user_type !== 'instructor' && userData.user_type !== 'admin') {
        setLoading(false);
        return;
      }

      const [planData, allUsers, assignmentsData] = await Promise.all([
        base44.entities.SessionPlan.filter({ id: planId }),
        base44.entities.User.list(),
        base44.entities.SessionPlanAssignment.filter({ session_plan_id: planId })
      ]);

      setPlan(planData[0]);
      setParticipants(allUsers.filter(u => u.user_type === 'participant' && u.participant_status === 'active'));
      setAssignments(assignmentsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAssigned = (participantId) => {
    return assignments.some(a => a.participant_id === participantId && a.status === 'active');
  };

  const handleAssign = async () => {
    if (selectedParticipants.length === 0) {
      toast.error('Please select at least one participant');
      return;
    }

    setAssigning(true);
    try {
      const assignmentPromises = selectedParticipants.map(participantId =>
        base44.entities.SessionPlanAssignment.create({
          session_plan_id: planId,
          participant_id: participantId,
          assigned_by: user.id,
          assigned_date: new Date().toISOString().split('T')[0],
          target_completion_date: targetDate || null,
          status: 'active'
        })
      );

      await Promise.all(assignmentPromises);
      toast.success(`Plan assigned to ${selectedParticipants.length} participant(s)`);
      setSelectedParticipants([]);
      setTargetDate('');
      loadData();
    } catch (error) {
      toast.error('Failed to assign plan');
    } finally {
      setAssigning(false);
    }
  };

  const toggleParticipant = (participantId) => {
    if (isAssigned(participantId)) {
      toast.error('Participant already assigned to this plan');
      return;
    }
    setSelectedParticipants(prev =>
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (user?.user_type !== 'instructor' && user?.user_type !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur max-w-md">
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">Only instructors and admins can assign session plans.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Plan not found</p>
        <Link to={createPageUrl('ManageSessionPlans')}>
          <Button className="mt-4">Back to Plans</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('ManageSessionPlans')}>
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Plans
        </Button>
      </Link>

      <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Assign: {plan.name}</CardTitle>
          {plan.description && <p className="text-sm text-gray-600 mt-2">{plan.description}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target Completion Date (Optional)</Label>
            <Input 
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <div>
            <Label className="mb-3 block">Select Participants ({selectedParticipants.length} selected)</Label>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {participants.map(participant => {
                const assigned = isAssigned(participant.id);
                const selected = selectedParticipants.includes(participant.id);
                return (
                  <div
                    key={participant.id}
                    onClick={() => !assigned && toggleParticipant(participant.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      assigned 
                        ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                        : selected
                        ? 'bg-indigo-50 border-indigo-300'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Checkbox 
                      checked={selected}
                      disabled={assigned}
                      onCheckedChange={() => !assigned && toggleParticipant(participant.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{participant.full_name}</p>
                      {assigned && <Badge variant="secondary" className="text-xs mt-1">Already assigned</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Button 
            onClick={handleAssign}
            disabled={assigning || selectedParticipants.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {assigning ? 'Assigning...' : `Assign to ${selectedParticipants.length} Participant(s)`}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Current Assignments ({assignments.filter(a => a.status === 'active').length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.filter(a => a.status === 'active').length === 0 ? (
            <p className="text-gray-500 text-center py-4">No active assignments yet</p>
          ) : (
            <div className="space-y-2">
              {assignments.filter(a => a.status === 'active').map(assignment => {
                const participant = participants.find(p => p.id === assignment.participant_id);
                return (
                  <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                        {participant?.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{participant?.full_name || 'Unknown'}</p>
                        {assignment.target_completion_date && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            Target: {new Date(assignment.target_completion_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-300">Active</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}