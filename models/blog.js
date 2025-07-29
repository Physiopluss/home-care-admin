const mongoose = require('mongoose')
const slugify = require('slugify');

const blogSchema = mongoose.Schema({
    title: {
        type: String
    },
    body: {
        type: String
    },
    coverImage: {
        type: String
    },
    tags: [{
        type: String,
    }],
    status: {
        type: Number,   //0-active ,1-disable
        default: 0
    },
    slug: {
        type: String
    }
}, { timestamps: true })

// Generate and Save Unique Slug
blogSchema.pre('save', async function (next) {
    if (this.slug) return next(); // Don't overwrite if slug already exists

    const nameSlug = this.title ? this.title.toLowerCase() : 'blog';
    let slug = slugify(nameSlug, { lower: true, strict: true });

    let counter = 1;

    // Check for uniqueness in DB
    while (await mongoose.models.Blog.findOne({ slug })) {
        if (counter > 999) {
            slug = slugify(`${slug}-${this._id.toString()}`, { lower: true, strict: true });
            break;
        }

        slug = slugify(`${slug}-${counter}`, { lower: true, strict: true });
        counter++;
    }

    this.slug = slug;
    console.debug(`[DEBUG/MongoDB] Blog model pre-save hook: Generated final slug "${this.slug}" for "${this.title}" (_id: ${this._id})`);
    next();
});

module.exports = mongoose.model('Blog', blogSchema)
