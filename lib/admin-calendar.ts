import { TIME_ZONE } from "@/lib/business-settings";
import { listBookings, markBookingCancelled } from "@/lib/bookings";

export { TIME_ZONE, listBookings };

export async function deleteBooking(eventId: string) {
  return await markBookingCancelled(eventId);
}
