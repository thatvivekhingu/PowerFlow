'use client'

import React from 'react'
import {
  MapPin,
  Navigation,
  Sun,
  Home,
  ShieldCheck,
  Compass,
  ArrowRight,
  Activity
} from 'lucide-react'

interface ParticipantLocation {
  name: string
  address: string
  feeder_id: string
  operator_id?: string
  latitude: number
  longitude: number
  distance_to_substation_km: number
  grid_node: string
  generation_source?: string
  load_profile?: string
}

interface GridLocationRadarProps {
  buyerLocation?: ParticipantLocation
  sellerLocation?: ParticipantLocation
  mediatingOperatorName?: string
  physicalDistanceKm?: number
  electricalPath?: string
  isCrossOperator?: boolean
}

export default function GridLocationRadar({
  buyerLocation = {
    name: 'Consumer Residence (You)',
    address: 'Tower C, Apartment 402, Maple Heights, Sector 22',
    feeder_id: 'FEEDER-02',
    latitude: 28.5615,
    longitude: 77.4105,
    distance_to_substation_km: 0.22,
    grid_node: 'NODE-S22-C01',
    load_profile: 'Domestic Smart Meter',
  },
  sellerLocation = {
    name: 'Prosumer Solar Rooftop',
    address: 'Villa #14, Green Meadows Solar Colony, Sector 14',
    feeder_id: 'FEEDER-01',
    latitude: 28.5362,
    longitude: 77.3925,
    distance_to_substation_km: 0.35,
    grid_node: 'NODE-N14-P01',
    generation_source: '5 kW Rooftop Solar + 5 kWh BESS',
  },
  mediatingOperatorName = 'DISCOM Substation Grid Operator (Central Clearing Median)',
  physicalDistanceKm = 3.2,
  electricalPath = 'Inter-Substation 33kV Tie-Line (TL-NORTH-SOUTH-33KV)',
  isCrossOperator = true,
}: GridLocationRadarProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4 animate-fade-in">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              Physical Location & Grid Network Topology
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                {physicalDistanceKm} km Transit
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Verified GPS telemetry for both parties with Grid Operator median routing.
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1">
          <Activity className="w-3 h-3 text-emerald-600" />
          Telemetry Active
        </span>
      </div>

      {/* Geolocation Visual Schematic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
        {/* SELLER LOCATION CARD */}
        <div className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-200/80 flex flex-col justify-between space-y-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-500" /> Seller Location
              </span>
              <span className="text-[9px] font-mono font-bold text-amber-800 bg-white px-2 py-0.5 rounded-md border border-amber-200">
                {sellerLocation.feeder_id}
              </span>
            </div>
            <h5 className="text-xs font-bold text-slate-900 mt-1.5">{sellerLocation.name}</h5>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
              📍 {sellerLocation.address}
            </p>
          </div>

          <div className="pt-2 border-t border-amber-200/60 text-[10px] font-mono space-y-0.5">
            <div className="flex justify-between text-slate-500">
              <span>Coordinates:</span>
              <span className="font-bold text-slate-800">{sellerLocation.latitude.toFixed(4)}° N, {sellerLocation.longitude.toFixed(4)}° E</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Grid Node:</span>
              <span className="font-bold text-amber-800">{sellerLocation.grid_node}</span>
            </div>
          </div>
        </div>

        {/* MEDIAN GRID OPERATOR HUB */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200 flex flex-col justify-between space-y-2 text-center">
          <div>
            <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Median Intermediary
            </span>
            <h5 className="text-xs font-black text-slate-900 mt-1">DISCOM Grid Operator</h5>
            <p className="text-[10px] text-indigo-950 mt-0.5 font-medium leading-snug">
              Central Clearing Counterparty (CCP)
            </p>
          </div>

          {/* Graphical Routing Indicator */}
          <div className="p-2 rounded-xl bg-white border border-indigo-100 space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold text-indigo-900">
              <span>Seller</span>
              <ArrowRight className="w-3 h-3 text-indigo-400" />
              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">DISCOM</span>
              <ArrowRight className="w-3 h-3 text-indigo-400" />
              <span>Buyer</span>
            </div>
            <span className="text-[9px] text-slate-500 block">
              {electricalPath}
            </span>
          </div>

          <div className="text-[10px] text-indigo-800 font-medium">
            ⚡ Zero Direct Peer Dealing
          </div>
        </div>

        {/* BUYER LOCATION CARD */}
        <div className="p-3.5 rounded-2xl bg-blue-50/40 border border-blue-200/80 flex flex-col justify-between space-y-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                <Home className="w-3 h-3 text-blue-500" /> Buyer Location (You)
              </span>
              <span className="text-[9px] font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                {buyerLocation.feeder_id}
              </span>
            </div>
            <h5 className="text-xs font-bold text-slate-900 mt-1.5">{buyerLocation.name}</h5>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
              📍 {buyerLocation.address}
            </p>
          </div>

          <div className="pt-2 border-t border-blue-200/60 text-[10px] font-mono space-y-0.5">
            <div className="flex justify-between text-slate-500">
              <span>Coordinates:</span>
              <span className="font-bold text-slate-800">{buyerLocation.latitude.toFixed(4)}° N, {buyerLocation.longitude.toFixed(4)}° E</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Grid Node:</span>
              <span className="font-bold text-blue-800">{buyerLocation.grid_node}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
