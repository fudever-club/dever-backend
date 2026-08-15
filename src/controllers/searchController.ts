import { Request, Response, NextFunction } from 'express';
import { Blog } from '../models/BlogModel';
import { Event } from '../models/EventModel';
import { Resource } from '../models/ResourceModel';
import { ProjectLab } from '../models/ProjectLabModel';
import { User } from '../models/UserModel';

export interface SearchResultItem {
  id: string;
  title: string;
  category: 'Blog' | 'Event' | 'Resource' | 'Member' | 'Project';
  url: string;
  subtitle: string;
  extra?: any;
}

export const globalSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawQuery = (req.query.q as string || '').trim();
    if (!rawQuery) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: [],
      });
    }

    const regex = new RegExp(rawQuery, 'i');
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    // Search across 5 domains in parallel
    const [blogs, events, resources, projects, users] = await Promise.all([
      Blog.find({
        status: 'published',
        $or: [{ title: regex }, { excerpt: regex }, { tags: regex }, { category: regex }],
      })
        .select('title slug excerpt category readTime author tags')
        .limit(8)
        .lean(),

      Event.find({
        $or: [{ name: regex }, { description: regex }, { location: regex }],
      })
        .select('name description location time')
        .limit(6)
        .lean(),

      Resource.find({
        $or: [{ title: regex }, { type: regex }, { category: regex }],
      })
        .select('title type category size fileUrl')
        .limit(6)
        .lean(),

      ProjectLab.find({
        $or: [{ title: regex }, { description: regex }, { techStack: regex }],
      })
        .select('title description techStack role')
        .limit(6)
        .lean(),

      User.find({
        $or: [
          { firstname: regex },
          { lastname: regex },
          { nickname: regex },
          { major: regex },
          { MSSV: regex },
        ],
      })
        .select('firstname lastname nickname major gen profileKey')
        .limit(6)
        .lean(),
    ]);

    const results: SearchResultItem[] = [];

    // Map Blogs
    blogs.forEach((b: any) => {
      results.push({
        id: `blog_${b._id}`,
        title: b.title,
        category: 'Blog',
        url: `/blog/${encodeURIComponent(b.slug)}`,
        subtitle: `${b.category || 'Tech Blog'} • ${b.readTime || '5 phút đọc'} • Tác giả: ${b.author?.name || 'DEVER'}`,
      });
    });

    // Map Events
    events.forEach((e: any) => {
      results.push({
        id: `event_${e._id}`,
        title: e.name,
        category: 'Event',
        url: '/events',
        subtitle: `${e.time ? new Date(e.time).toLocaleDateString('vi-VN') : 'Sự kiện'} • ${e.location || 'FPT University Đà Nẵng'}`,
      });
    });

    // Map Resources
    resources.forEach((r: any) => {
      results.push({
        id: `res_${r._id}`,
        title: r.title,
        category: 'Resource',
        url: '/resources',
        subtitle: `${r.type || 'Tài liệu'} • ${r.category || 'Học thuật'} • ${r.size || 'Download trực tiếp'}`,
      });
    });

    // Map Project Labs
    projects.forEach((p: any) => {
      results.push({
        id: `proj_${p._id}`,
        title: p.title,
        category: 'Project',
        url: '/project-lab',
        subtitle: `${p.role || 'Dự án thực tế'} • ${Array.isArray(p.techStack) ? p.techStack.join(', ') : 'Tech Lab'}`,
      });
    });

    // Map Members
    users.forEach((u: any) => {
      const name = [u.firstname, u.lastname].filter(Boolean).join(' ') || u.nickname || 'Thành viên DEVER';
      results.push({
        id: `user_${u._id}`,
        title: name,
        category: 'Member',
        url: u.profileKey ? `/profile/${u.profileKey}` : '/members',
        subtitle: `Gen ${u.gen || '9'} • Chuyên ngành: ${u.major || 'Kỹ thuật phần mềm (SE)'}`,
      });
    });

    res.status(200).json({
      status: 'success',
      results: results.length,
      data: results.slice(0, limit),
    });
  } catch (error) {
    next(error);
  }
};
