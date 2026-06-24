import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Upload, CheckCircle2, Loader2, PlusCircle, X, Camera } from 'lucide-react';
import { toast } from 'sonner';

const DRILL_OPTIONS = [
{ value: '1k_run', label: '1K Run' },
{ value: '2k_run', label: '2K Run' },
{ value: '3km_run', label: '3K Run' },
{ value: '300m_crawl', label: '300M Crawl' },
{ value: 'full_gan_saccer_crawl', label: 'Full Gan Saccer Crawl' }];


function parseTimeToSeconds(mmss) {
  const parts = mmss.split(':');
  if (parts.length !== 2) return null;
  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  if (isNaN(mins) || isNaN(secs) || secs >= 60) return null;
  return mins * 60 + secs;
}

export default function LogEntryForm({ user, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [drillType, setDrillType] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeInput, setTimeInput] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const cameraInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    setProofFile(null);
    setProofPreview(null);
  };

  // Format time input automatically (insert colon)
  const handleTimeChange = (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 4) val = val.slice(0, 4);
    if (val.length >= 3) val = val.slice(0, 2) + ':' + val.slice(2);
    setTimeInput(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!drillType) {toast.error('Please select an activity type');return;}
    if (!timeInput || timeInput.length < 4) {toast.error('Please enter a valid time (MM:SS)');return;}

    const seconds = parseTimeToSeconds(timeInput);
    if (!seconds) {toast.error('Invalid time format. Use MM:SS (e.g. 08:30)');return;}

    setSubmitting(true);
    let proof_url = null;

    if (proofFile) {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: proofFile });
      proof_url = file_url;
      setUploading(false);
    }

    await base44.entities.PerformanceRecord.create({
      participant_id: user.id,
      recorded_by: user.id,
      drill_type: drillType,
      record_date: date,
      time_seconds: seconds,
      proof_url,
      status: 'pending_verification'
    });

    setSubmitting(false);
    setSuccess(true);

    setTimeout(() => {
      setSuccess(false);
      setDrillType('');
      setDate(new Date().toISOString().split('T')[0]);
      setTimeInput('');
      setProofFile(null);
      setProofPreview(null);
      setOpen(false);
      if (onSubmitted) onSubmitted();
    }, 1800);
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)} className="bg-[#2a9347] text-white px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-primary/90 h-9 w-full from-indigo-600 to-purple-600 shadow-lg hover:opacity-90">


        <PlusCircle className="w-4 h-4 mr-2" />
        Log Activity Result
      </Button>);

  }

  return (
    <Card className="border-2 border-indigo-200 shadow-xl bg-white">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2 text-indigo-700">
          <PlusCircle className="w-5 h-5" />
          Log Activity Result
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {success ?
        <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="w-14 h-14 text-green-500" />
            <p className="text-lg font-semibold text-green-700">Result Logged!</p>
            <p className="text-sm text-gray-500 text-center">Your result has been submitted and is pending verification by an admin.</p>
          </div> :

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Activity Type */}
            <div className="space-y-1.5">
              <Label>Activity Type</Label>
              <Select value={drillType} onValueChange={setDrillType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select activity..." />
                </SelectTrigger>
                <SelectContent>
                  {DRILL_OPTIONS.map((o) =>
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                )}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
              type="date"
              value={date}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)} />

            </div>

            {/* Time */}
            <div className="space-y-1.5">
              <Label>Time (MM:SS)</Label>
              <Input
              placeholder="e.g. 08:30"
              value={timeInput}
              onChange={handleTimeChange}
              inputMode="numeric" />

              <p className="text-xs text-gray-400">Enter minutes and seconds (e.g. 04:00 for 4 minutes, 0 seconds)</p>
            </div>

            {/* Proof Upload */}
            <div className="space-y-1.5">
              <Label>Upload Proof Screenshot <span className="text-gray-400 font-normal">(optional)</span></Label>
              {proofPreview ? (
                <div className="relative w-full rounded-xl overflow-hidden border-2 border-green-200 shadow-sm">
                  <img src={proofPreview} alt="Proof" className="w-full max-h-64 object-contain bg-gray-50" />
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="absolute top-2 right-2 bg-white rounded-full shadow-md p-1.5 hover:bg-red-50 transition-colors">
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Proof added
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {/* Camera capture — opens native camera on mobile */}
                  <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-blue-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                    <Camera className="w-7 h-7 text-blue-400 mb-1" />
                    <span className="text-xs text-blue-600 font-medium">Take Photo</span>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  {/* Gallery / file picker */}
                  <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                    <Upload className="w-7 h-7 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500">Upload Screenshot</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              )}
              <p className="text-xs text-gray-400">Take a photo of the finish clock or upload an app screenshot as proof.</p>
            </div>

            <Button
            type="submit"
            disabled={submitting} className="bg-[#489d6a] text-white px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-9 w-full from-indigo-600 to-purple-600">


              {submitting ?
            <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploading ? 'Uploading proof...' : 'Submitting...'}
                </> :
            'Submit Result'}
            </Button>

            <p className="text-xs text-center text-gray-400">
              Submitted results are marked <strong>Pending Verification</strong> until reviewed by an admin.
            </p>
          </form>
        }
      </CardContent>
    </Card>);

}