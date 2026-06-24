import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfileDetailsTab({ user, onUserUpdate }) {
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    profile_image_url: user?.profile_image_url || ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(f => ({ ...f, profile_image_url: file_url }));
      toast.success('Image uploaded');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.full_name) { toast.error('Full name is required'); return; }
    setSaving(true);
    try {
      await base44.auth.updateMe({
        full_name: formData.full_name,
        phone: formData.phone,
        profile_image_url: formData.profile_image_url
      });
      toast.success('Profile updated successfully');
      if (onUserUpdate) onUserUpdate({ ...user, ...formData });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
      <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {formData.profile_image_url ? (
              <img src={formData.profile_image_url} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-indigo-100" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-4 border-indigo-100">
                <span className="text-4xl font-bold text-white">{formData.full_name?.charAt(0)?.toUpperCase() || '?'}</span>
              </div>
            )}
            <label htmlFor="profile-image-tab" className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full cursor-pointer shadow-lg transition-all">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            </label>
            <input id="profile-image-tab" type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
          </div>
          <p className="text-sm text-gray-500">Click the camera icon to upload a profile picture</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={formData.full_name} onChange={(e) => setFormData(f => ({ ...f, full_name: e.target.value }))} placeholder="Enter your full name" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled className="bg-gray-50 text-gray-500" />
            <p className="text-xs text-gray-500">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input value={formData.phone} onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))} placeholder="Enter your phone number" type="tel" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={user?.user_type || ''} disabled className="bg-gray-50 text-gray-500 capitalize" />
          </div>
          {user?.age != null && (
            <div className="space-y-2">
              <Label>Age</Label>
              <Input value={`${user.age} years old`} disabled className="bg-gray-50 text-gray-500" />
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  );
}