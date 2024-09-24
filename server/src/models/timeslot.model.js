/**
 * @class Timeslot
 */
class Timeslot {
  constructor(id, time, assistantName) {
    this.time = time;
    this.assistantName = assistantName;
    this.id = id;
    this.status = "Available";
    this.bookedBy = "";
  }

  /**
   * Book the timeslot.
   * @param {String} name - The name to book with.
   * @returns {Boolean} successful or not (timeslot not available).
   */
  bookTimeslot(name) {
    if (this.status === "Available") {
      this.bookedBy = name;
      this.status = "Booked";
      return true;
    }
    return false;
  }
}

export default Timeslot;
