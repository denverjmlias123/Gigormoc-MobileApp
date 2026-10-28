import { applicationsService, ApplicationItem } from './applications';
import { gigsService } from './gigs';
import { offlineSyncService } from './offlineSync';

export interface ClientApplicantSummary {
  totalGigs: number;
  totalApplicants: number;
  pendingCount: number;
  acceptedCount: number;
  declinedCount: number;
  acceptanceRate: number; // percentage 0-100
  gigBreakdowns: {
    gigId: string;
    gigTitle: string;
    status: string;
    totalApplicants: number;
    pendingCount: number;
    acceptedCount: number;
    declinedCount: number;
  }[];
  allApplicants: (ApplicationItem & { gigTitle: string })[];
}

export interface FreelancerApplicationSummary {
  totalApplied: number;
  pendingCount: number;
  acceptedCount: number;
  declinedCount: number;
  counteredCount: number;
  successRate: number; // percentage 0-100
  applications: ApplicationItem[];
}

export const applicantReportsService = {
  async getClientReport(clientId: string): Promise<ClientApplicantSummary> {
    try {
      const gigs = await gigsService.getMyGigs(clientId);
      const gigBreakdowns: ClientApplicantSummary['gigBreakdowns'] = [];
      const allApplicants: (ApplicationItem & { gigTitle: string })[] = [];

      let totalApplicants = 0;
      let pendingCount = 0;
      let acceptedCount = 0;
      let declinedCount = 0;

      await Promise.all(
        gigs.map(async (g) => {
          try {
            const apps = await applicationsService.getGigApplicants(g.id);
            let gPending = 0;
            let gAccepted = 0;
            let gDeclined = 0;

            apps.forEach((app) => {
              allApplicants.push({ ...app, gigTitle: g.title });
              if (app.status === 'accepted') {
                gAccepted++;
                acceptedCount++;
              } else if (app.status === 'declined') {
                gDeclined++;
                declinedCount++;
              } else {
                gPending++;
                pendingCount++;
              }
              totalApplicants++;
            });

            gigBreakdowns.push({
              gigId: g.id,
              gigTitle: g.title,
              status: g.status,
              totalApplicants: apps.length,
              pendingCount: gPending,
              acceptedCount: gAccepted,
              declinedCount: gDeclined,
            });
          } catch {
            // Keep going if a single gig applicants fail
          }
        })
      );

      const acceptanceRate =
        totalApplicants > 0 ? Math.round((acceptedCount / totalApplicants) * 100) : 0;

      // Sort applicants by date descending
      allApplicants.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const report: ClientApplicantSummary = {
        totalGigs: gigs.length,
        totalApplicants,
        pendingCount,
        acceptedCount,
        declinedCount,
        acceptanceRate,
        gigBreakdowns,
        allApplicants,
      };

      await offlineSyncService.cacheItem(`@offline_client_report_${clientId}`, report);
      return report;
    } catch (err) {
      const cached = await offlineSyncService.getCachedItem<ClientApplicantSummary>(
        `@offline_client_report_${clientId}`
      );
      if (cached) return cached;
      throw err;
    }
  },

  async getFreelancerReport(): Promise<FreelancerApplicationSummary> {
    try {
      const apps = await applicationsService.getMyApplications();

      let pendingCount = 0;
      let acceptedCount = 0;
      let declinedCount = 0;
      let counteredCount = 0;

      apps.forEach((app) => {
        if (app.status === 'accepted') {
          acceptedCount++;
        } else if (app.status === 'declined') {
          declinedCount++;
        } else if (app.status === 'countered') {
          counteredCount++;
          pendingCount++;
        } else {
          pendingCount++;
        }
      });

      const totalApplied = apps.length;
      const successRate = totalApplied > 0 ? Math.round((acceptedCount / totalApplied) * 100) : 0;

      const report: FreelancerApplicationSummary = {
        totalApplied,
        pendingCount,
        acceptedCount,
        declinedCount,
        counteredCount,
        successRate,
        applications: apps,
      };

      await offlineSyncService.cacheItem('@offline_freelancer_report', report);
      return report;
    } catch (err) {
      const cached = await offlineSyncService.getCachedItem<FreelancerApplicationSummary>(
        '@offline_freelancer_report'
      );
      if (cached) return cached;
      throw err;
    }
  },
};
