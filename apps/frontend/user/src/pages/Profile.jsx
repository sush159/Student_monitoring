import React, { useState, useEffect } from 'react'
import { User, Mail, Phone, Github, Hash, Edit3, Save, X, ExternalLink, AlertCircle } from 'lucide-react'
import { profileService } from '../services/profileService'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  const loadProfile = () => {
    setLoading(true)
    setError(null)
    profileService.get()
      .then(p => {
        setProfile(p)
        setForm({ name: p.name, email: p.email, phone: p.phone, github: p.github })
      })
      .catch(err => setError(err.message || 'Failed to load profile'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadProfile() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await profileService.update(form)
      setProfile(updated)
      setForm({ name: updated.name, email: updated.email, phone: updated.phone, github: updated.github })
      setEditing(false)
      setSuccessMsg('Profile updated successfully!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm({ name: profile.name, email: profile.email, phone: profile.phone, github: profile.github })
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 border border-red-200 text-center space-y-4 max-w-md mx-auto mt-10">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-red-500 font-semibold">{error}</p>
        <button onClick={loadProfile} className="btn-primary text-xs px-4 py-2">Try Again</button>
      </div>
    )
  }

  const initials = profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">View and update your student profile</p>
      </div>

      {/* Avatar + name card */}
      <div className="card text-center relative overflow-hidden">
        {/* Background accent */}
        <div className="absolute inset-x-0 top-0 h-20 gradient-primary opacity-10 rounded-t-card" />

        <div className="relative z-10">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-card">
            {initials}
          </div>
          <h2 className="text-xl font-bold text-text-primary">{profile.name}</h2>
          <p className="text-sm text-text-secondary mt-0.5">{profile.department} • {profile.year}</p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-primary-light rounded-full">
            <Hash className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">{profile.registerNumber}</span>
          </div>
        </div>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="px-4 py-3 bg-success-soft rounded-xl text-sm text-green-700 font-semibold">
          ✓ {successMsg}
        </div>
      )}

      {/* Info card */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-text-primary">Personal Information</h3>
          {!editing ? (
            <button
              id="edit-profile-btn"
              onClick={() => setEditing(true)}
              className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-2"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleCancel} className="btn-tertiary text-xs px-3 py-2 flex items-center gap-1">
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                id="save-profile-btn"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-xs px-3 py-2 flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label className="label flex items-center gap-1.5">
              <User className="w-3 h-3" /> Full Name
            </label>
            {editing ? (
              <input
                id="profile-name"
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            ) : (
              <p className="text-sm font-semibold text-text-primary px-1">{profile.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Mail className="w-3 h-3" /> Email
            </label>
            {editing ? (
              <input
                id="profile-email"
                type="email"
                className="input"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            ) : (
              <p className="text-sm font-semibold text-text-primary px-1">{profile.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Phone className="w-3 h-3" /> Phone Number
            </label>
            {editing ? (
              <input
                id="profile-phone"
                type="tel"
                className="input"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            ) : (
              <p className="text-sm font-semibold text-text-primary px-1">{profile.phone}</p>
            )}
          </div>

          {/* GitHub */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Github className="w-3 h-3" /> GitHub
            </label>
            {editing ? (
              <input
                id="profile-github"
                type="url"
                className="input"
                placeholder="https://github.com/username"
                value={form.github}
                onChange={e => setForm(f => ({ ...f, github: e.target.value }))}
              />
            ) : (
              <a
                id="github-link"
                href={profile.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-dark transition-colors px-1 group"
              >
                <Github className="w-4 h-4" />
                {profile.github.replace('https://github.com/', '@')}
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Department info (read-only) */}
      <div className="card">
        <h3 className="text-sm font-bold text-text-primary mb-4">Academic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-background rounded-xl px-4 py-3 border border-gray-50">
            <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Department</p>
            <p className="text-sm font-bold text-text-primary mt-1">{profile.department}</p>
          </div>
          <div className="bg-background rounded-xl px-4 py-3 border border-gray-50">
            <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Year</p>
            <p className="text-sm font-bold text-text-primary mt-1">{profile.year}</p>
          </div>
          <div className="bg-background rounded-xl px-4 py-3 border border-gray-50">
            <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Register No.</p>
            <p className="text-sm font-bold text-primary mt-1">{profile.registerNumber}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
