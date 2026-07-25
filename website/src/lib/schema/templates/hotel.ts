/**
 * Hotel Template Schema
 *
 * Sector: Hotel & lodging
 * W3C Standard: OTA (OpenTravel Alliance) for room/rate/booking
 * schema.org: Hotel, LodgingBusiness
 */

import type { W3CSchemaDefinition } from '../types';

export const HOTEL_SCHEMA: W3CSchemaDefinition = {
  templateId: 'hotel',
  label: 'Hotel',
  description: 'Hotel operations: room inventory, reservations, occupancy tracking, event space management, RevPAR analysis.',
  schemaOrgType: ['Hotel', 'LodgingBusiness'],
  xsdStandard: 'OTA',
  defaultColors: { primary: '#1565c0', secondary: '#ffb74d' },

  models: [
    {
      name: 'RoomType',
      tableName: 'room_types',
      schemaOrgMapping: {
        name: 'name',
        basePrice: 'offers.price',
        capacity: 'occupancy',
        amenities: 'amenityFeature',
      },
      fields: [
        { name: 'name', type: 'string', required: true, unique: true, schemaOrgProperty: 'name', label: 'Room Type Name', width: 12 },
        { name: 'description', type: 'text', schemaOrgProperty: 'description', label: 'Description', width: 12 },
        { name: 'basePrice', type: 'decimal', required: true, schemaOrgProperty: 'offers.price', label: 'Base Price (IDR/night)', width: 6 },
        { name: 'capacity', type: 'integer', required: true, schemaOrgProperty: 'occupancy', label: 'Max Occupancy', width: 6 },
        { name: 'bedType', type: 'enum', required: true, enumValues: ['single', 'double', 'queen', 'king', 'twin', 'suite'], label: 'Bed Type', width: 6 },
        { name: 'amenities', type: 'json', default: [], schemaOrgProperty: 'amenityFeature', label: 'Amenities', width: 12 },
        { name: 'imageUrl', type: 'string', schemaOrgProperty: 'image', label: 'Image URL', width: 12 },
        { name: 'totalRooms', type: 'integer', required: true, label: 'Total Rooms', width: 6 },
      ],
    },
    {
      name: 'Room',
      tableName: 'rooms',
      schemaOrgMapping: {
        roomNumber: 'roomNumber',
        floor: 'floorLevel',
      },
      fields: [
        { name: 'roomNumber', type: 'string', required: true, unique: true, schemaOrgProperty: 'roomNumber', label: 'Room Number', width: 6 },
        { name: 'floor', type: 'integer', required: true, schemaOrgProperty: 'floorLevel', label: 'Floor', width: 6 },
        { name: 'roomTypeId', type: 'string', required: true, label: 'Room Type ID', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['available', 'occupied', 'cleaning', 'maintenance', 'out_of_order'], default: 'available', label: 'Status', width: 6 },
        { name: 'condition', type: 'enum', required: true, enumValues: ['excellent', 'good', 'fair', 'needs_repair'], default: 'good', label: 'Condition', width: 6 },
        { name: 'lastCleanedAt', type: 'datetime', label: 'Last Cleaned', width: 6 },
        { name: 'notes', type: 'text', label: 'Notes', width: 12 },
      ],
    },
    {
      name: 'Booking',
      tableName: 'bookings',
      schemaOrgMapping: {
        guestName: 'reservationFor.name',
        checkIn: 'checkinTime',
        checkOut: 'checkoutTime',
        partySize: 'partySize',
        totalAmount: 'totalPaymentDue',
      },
      fields: [
        { name: 'guestName', type: 'string', required: true, schemaOrgProperty: 'reservationFor.name', label: 'Guest Name', width: 12 },
        { name: 'guestEmail', type: 'string', required: true, label: 'Guest Email', width: 6 },
        { name: 'roomNumber', type: 'string', required: true, label: 'Room Number', width: 6 },
        { name: 'checkIn', type: 'date', required: true, schemaOrgProperty: 'checkinTime', label: 'Check-in Date', width: 6 },
        { name: 'checkOut', type: 'date', required: true, schemaOrgProperty: 'checkoutTime', label: 'Check-out Date', width: 6 },
        { name: 'partySize', type: 'integer', required: true, schemaOrgProperty: 'partySize', label: 'Party Size', width: 6 },
        { name: 'totalAmount', type: 'decimal', required: true, schemaOrgProperty: 'totalPaymentDue', label: 'Total Amount (IDR)', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'], default: 'pending', label: 'Status', width: 6 },
        { name: 'source', type: 'enum', enumValues: ['direct', 'booking_com', 'expedia', 'agoda', 'airbnb', 'walk_in'], label: 'Booking Source', width: 6 },
        { name: 'specialRequests', type: 'text', label: 'Special Requests', width: 12 },
      ],
    },
    {
      name: 'OccupancyDaily',
      tableName: 'occupancy_daily',
      fields: [
        { name: 'reportDate', type: 'date', required: true, unique: true, label: 'Report Date', width: 6 },
        { name: 'totalRooms', type: 'integer', required: true, label: 'Total Rooms', width: 6 },
        { name: 'occupiedRooms', type: 'integer', required: true, label: 'Occupied Rooms', width: 6 },
        { name: 'occupancyRate', type: 'decimal', required: true, label: 'Occupancy Rate (%)', width: 6 },
        { name: 'adr', type: 'decimal', required: true, label: 'ADR (IDR)', width: 6 },
        { name: 'revpar', type: 'decimal', required: true, label: 'RevPAR (IDR)', width: 6 },
        { name: 'revenue', type: 'decimal', required: true, label: 'Revenue (IDR)', width: 6 },
      ],
    },
    {
      name: 'EventSpace',
      tableName: 'event_spaces',
      schemaOrgMapping: {
        name: 'name',
        hourlyRate: 'offers.price',
        capacity: 'maximumAttendeeCapacity',
      },
      fields: [
        { name: 'name', type: 'string', required: true, unique: true, schemaOrgProperty: 'name', label: 'Space Name', width: 12 },
        { name: 'capacity', type: 'integer', required: true, schemaOrgProperty: 'maximumAttendeeCapacity', label: 'Max Capacity', width: 6 },
        { name: 'hourlyRate', type: 'decimal', required: true, schemaOrgProperty: 'offers.price', label: 'Hourly Rate (IDR)', width: 6 },
        { name: 'description', type: 'text', label: 'Description', width: 12 },
        { name: 'amenities', type: 'json', default: [], label: 'Amenities', width: 12 },
        { name: 'status', type: 'enum', required: true, enumValues: ['available', 'booked', 'maintenance'], default: 'available', label: 'Status', width: 6 },
      ],
    },
  ],

  useCases: [
    { id: 'UC-HOTEL-01', title: 'View room types & availability', auth: 'public', route: '/rooms', blockTypes: ['dynamic_form'], models: ['RoomType', 'Room'] },
    { id: 'UC-HOTEL-02', title: 'Manage room inventory', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Room', 'RoomType'] },
    { id: 'UC-HOTEL-03', title: 'Create booking', auth: 'public', route: '/bookings', blockTypes: ['dynamic_form'], models: ['Booking'] },
    { id: 'UC-HOTEL-04', title: 'Daily occupancy tracking', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['OccupancyDaily'] },
    { id: 'UC-HOTEL-05', title: 'Event space booking', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['EventSpace'] },
    { id: 'UC-HOTEL-06', title: 'Revenue & RevPAR dashboard', auth: 'public', route: '/dashboard', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], models: ['OccupancyDaily'] },
  ],

  pages: [
    { slug: 'dashboard', title: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], navLabel: 'Dashboard' },
    { slug: 'rooms', title: 'Rooms', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Rooms' },
    { slug: 'bookings', title: 'Bookings', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Bookings' },
    { slug: 'summary', title: 'Executive Summary', authTier: 'google', blockTypes: ['doc_markdown'], navLabel: 'Summary' },
    { slug: 'tasks', title: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'], navLabel: 'Tasks' },
    { slug: 'admin', title: 'Admin', authTier: 'pin', blockTypes: ['dynamic_form', 'action_checklist'], navLabel: 'Admin' },
  ],

  blocks: [
    { type: 'hero', label: 'Hero Banner' },
    { type: 'kpi_cards', label: 'KPI Cards' },
    { type: 'chart_financial', label: 'Financial Chart' },
    { type: 'dynamic_form', label: 'Dynamic Form (Schema-Driven)', model: 'RoomType' },
    { type: 'action_checklist', label: 'Action Checklist' },
    { type: 'doc_markdown', label: 'Markdown Document' },
  ],
};
