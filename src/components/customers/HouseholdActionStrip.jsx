import React from 'react'
import { Button } from '@/components/ui/button'
import { Download, Plus, FileText, Users } from 'lucide-react'

export default function HouseholdActionStrip({ onDownloadPDF, onNewOpportunity, onNewFamilyMember, onReview, isDownloading }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={onDownloadPDF}
        disabled={isDownloading}
      >
        <Download className="w-4 h-4 mr-1" />
        {isDownloading ? 'PDF erstellen...' : 'Haushalts-PDF'}
      </Button>
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={onNewOpportunity}
      >
        <Plus className="w-4 h-4 mr-1" />
        Chance
      </Button>
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={onNewFamilyMember}
      >
        <Users className="w-4 h-4 mr-1" />
        Mitglied
      </Button>
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={onReview}
      >
        <FileText className="w-4 h-4 mr-1" />
        Review
      </Button>
    </div>
  )
}